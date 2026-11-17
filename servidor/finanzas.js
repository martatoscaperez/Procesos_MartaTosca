import { randomUUID } from 'node:crypto';
import { ErrorHogar } from './hogares.js';
export function centimos(valor, permitirCero = false) {
  if(typeof valor !== 'string' || !/^\d{1,7}([.,]\d{1,2})?$/.test(valor)) throw new ErrorHogar('Escribe un importe válido con hasta dos decimales.',400);
  const [entero, decimal='']=valor.replace(',','.').split('.');
  const total=Number(entero)*100+Number(decimal.padEnd(2,'0'));
  if(total<0 || (!permitirCero && total===0)) throw new ErrorHogar('El importe debe ser mayor que cero.',400);
  return total;
}
export function saldos(registros) {
  const neto=new Map(), nombres=new Map();
  const sumar=(id,nombre,n)=>{nombres.set(id,nombre);neto.set(id,(neto.get(id)||0)+n);};
  for(const r of registros) {
    if(r.tipo==='gasto') { sumar(r.pagador,r.nombrePagador,r.importe); for(const p of r.reparto) sumar(p.id,p.nombre,-p.importe); }
    else {sumar(r.deudor,r.nombreDeudor,r.importe);sumar(r.acreedor,r.nombreAcreedor,-r.importe);}
  }
  const deben=[...neto].filter(([,n])=>n<0).map(([id,n])=>({id,importe:-n}));
  const cobran=[...neto].filter(([,n])=>n>0).map(([id,importe])=>({id,importe}));
  const deudas=[];
  for(const d of deben) for(const c of cobran) {const importe=Math.min(d.importe,c.importe); if(importe) deudas.push({deudor:d.id,nombreDeudor:nombres.get(d.id),acreedor:c.id,nombreAcreedor:nombres.get(c.id),importe});d.importe-=importe;c.importe-=importe;}
  return deudas;
}
export function crearFinanzas(conexion, hogares) {
  const memoria=new Map();
  async function operar(id,accion, guardar=true) {
    if(!conexion) {const registros=structuredClone(memoria.get(id)||[]);const resultado=await accion(registros);memoria.set(id,registros);return resultado;}
    const c=await conexion.connect();
    try {await c.query('BEGIN');await c.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE',[id]);
      const {rows}=await c.query('SELECT datos FROM public.movimientos_hogar WHERE hogar_id=$1 ORDER BY creado_en,id',[id]);
      const registros=rows.map(r=>r.datos);const resultado=await accion(registros);
      if(guardar) {
        await c.query('DELETE FROM public.movimientos_hogar WHERE hogar_id=$1',[id]);
        for(const r of registros) await c.query('INSERT INTO public.movimientos_hogar (id,hogar_id,datos) VALUES ($1,$2,$3)',[r.id,id,r]);
      }
      await c.query('COMMIT');return resultado;
    }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }
  return {
    async consultar(id,email) {await hogares.consultar(id,email);return operar(id,rs=>({movimientos:rs,saldos:saldos(rs)}),false);},
    async guardar(id,email,datos) {
      const hogar=await hogares.consultar(id,email);
      return operar(id,rs=>{
        if(typeof datos.id!=='string'||!/^[0-9a-f-]{36}$/i.test(datos.id)) throw new ErrorHogar('Solicitud inválida.',400);
        const existente=rs.find(r=>r.id===datos.id);
        if(existente && datos.nuevo) return {guardado:true};
        if(existente?.tipo==='devolucion') throw new ErrorHogar('Las devoluciones no se editan.',400);
        const miembro=id=>{const m=hogar.miembros.find(m=>m.id===id);if(!m) throw new ErrorHogar('Selecciona compañeros del piso.',400);return m;};
        const importe=centimos(datos.importe);
        let registro;
        if(datos.tipo==='devolucion') {
          const deuda=saldos(rs).find(d=>d.deudor===datos.deudor&&d.acreedor===datos.acreedor);
          if(!deuda||importe>deuda.importe) throw new ErrorHogar('El saldo ha cambiado. Recarga y revisa la devolución.',409);
          registro={id:datos.id,tipo:'devolucion',deudor:deuda.deudor,acreedor:deuda.acreedor,nombreDeudor:deuda.nombreDeudor,nombreAcreedor:deuda.nombreAcreedor,importe,fecha:new Date().toISOString().slice(0,10)};
        } else {
          if(typeof datos.concepto!=='string'||!datos.concepto.trim()||datos.concepto.trim().length>100) throw new ErrorHogar('Escribe un concepto de hasta 100 caracteres.',400);
          if(typeof datos.fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)||Number.isNaN(Date.parse(datos.fecha))||new Date(datos.fecha).toISOString().slice(0,10)!==datos.fecha) throw new ErrorHogar('Elige una fecha válida.',400);
          const pagador=miembro(datos.pagador);
          if(!Array.isArray(datos.reparto)||!datos.reparto.length||new Set(datos.reparto.map(p=>p.id)).size!==datos.reparto.length) throw new ErrorHogar('Selecciona participantes sin repetirlos.',400);
          const reparto=datos.reparto.map((p,i)=>({id:miembro(p.id).id,nombre:miembro(p.id).nombre,importe:datos.personalizado?centimos(p.importe,true):Math.floor(importe/datos.reparto.length)+(i<importe%datos.reparto.length?1:0)}));
          if(reparto.reduce((s,p)=>s+p.importe,0)!==importe) throw new ErrorHogar('El reparto debe sumar el importe total.',400);
          registro={id:datos.id,tipo:'gasto',concepto:datos.concepto.trim(),fecha:datos.fecha,pagador:pagador.id,nombrePagador:pagador.nombre,importe,reparto};
        }
        if(existente) rs.splice(rs.indexOf(existente),1,registro);else rs.push(registro);
        return {guardado:true};
      });
    },
    async eliminar(id,email,movimiento) {await hogares.consultar(id,email);return operar(id,rs=>{const indice=rs.findIndex(r=>r.id===movimiento);if(indice<0) throw new ErrorHogar('El movimiento ya no existe.',404);rs.splice(indice,1);return {eliminado:true};});}
  };
}
