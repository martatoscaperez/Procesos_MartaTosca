import { solicitarHogares } from '../comunicacion/rest.js';
export function prepararGastos(id, hogar) {
  const $=id=>document.getElementById(id), ruta='/'+encodeURIComponent(id)+'/gastos';
  const form=$('formulario-gasto'), dialogo=$('dialogo-gasto'), devolucion=$('formulario-devolucion');
  const moneda=new Intl.NumberFormat('es-ES',{style:'currency',currency:hogar.moneda});
  const dinero=n=>moneda.format(n/100), decimal=n=>(n/100).toFixed(2);
  const nodo=(tag,texto,clase)=>{const n=document.createElement(tag);n.textContent=texto;if(clase)n.className=clase;return n;};
  let movimientos=[],deudas=[],editando=null,solicitud=null,deudaActual=null,solicitudDevolucion=null,ocupado=false,revision=0;
  const boton=(texto,accion)=>{const b=nodo('button',texto);b.type='button';b.addEventListener('click',accion);return b;};
  let soloMisSaldos = false;
  async function cargar() {
    const version=++revision;
    try {const datos=await solicitarHogares(ruta);if(version!==revision)return;movimientos=datos.movimientos;deudas=datos.saldos;render();$('estado-gastos').textContent='';}
    catch(e){$('estado-gastos').textContent=e.message;}
  }
  function render() {
    const propia = hogar.miembros.find(miembro => miembro.propia)?.id;
    const misGastos = movimientos.filter(movimiento => movimiento.tipo === 'gasto'
      && movimiento.reparto.some(parte => parte.id === propia))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    $('gastos-pendientes-inicio').textContent = dinero(misGastos.reduce((total, gasto) => total + gasto.reparto.find(parte => parte.id === propia).importe, 0));
    $('enlace-gastos-inicio').title = 'Suma de tu parte en los gastos compartidos.';
    $('lista-gastos').replaceChildren();$('lista-saldos').replaceChildren();$('lista-devoluciones').replaceChildren();
    const gastos=movimientos.filter(r=>r.tipo==='gasto').sort((a,b)=>b.fecha.localeCompare(a.fecha));
    if(!gastos.length)$('lista-gastos').append(nodo('p','Todavía no hay gastos.','ayuda-gastos'));
    for(const gasto of gastos) {
      const detalle=document.createElement('details');detalle.className='fila-gasto';
      const resumen=document.createElement('summary');
      resumen.append(nodo('span',gasto.concepto,'concepto-gasto'),nodo('span',gasto.nombrePagador,'dato-gasto'),nodo('time',new Date(gasto.fecha+'T12:00:00').toLocaleDateString('es-ES'),'dato-gasto'),nodo('strong',dinero(gasto.importe)));
      const acciones=document.createElement('details');acciones.className='menu-gasto';acciones.append(nodo('summary','⋯'));acciones.querySelector('summary').setAttribute('aria-label','Opciones de '+gasto.concepto);
      const opciones=document.createElement('div');opciones.append(boton('Editar',()=>{acciones.open=false;abrir(gasto);}),boton('Eliminar',async()=>{
        if(ocupado)return;ocupado=true;
        try{await solicitarHogares(ruta+'/'+gasto.id+'/eliminar',{});await cargar();}catch(e){$('estado-gastos').textContent=e.message;}finally{ocupado=false;}
      }));acciones.append(opciones);
      const cabecera=document.createElement('div');cabecera.className='cabecera-fila-gasto';cabecera.append(detalle,acciones);detalle.append(resumen);
      const reparto=document.createElement('div');reparto.className='detalle-reparto';reparto.append(nodo('p','Repartido entre:'));
      for(const p of gasto.reparto)reparto.append(nodo('p',p.nombre+' · '+dinero(p.importe)));detalle.append(reparto);$('lista-gastos').append(cabecera);
    }
    const saldosVisibles = deudas.filter(d => !soloMisSaldos || d.deudor === propia);
    if(!saldosVisibles.length)$('lista-saldos').append(nodo('p',soloMisSaldos ? 'No debes dinero a ningún compañero.' : 'Todo saldado. Nadie debe dinero.','ayuda-gastos'));
    for(const d of saldosVisibles) {
      const fila=nodo('div','','fila-saldo');fila.append(nodo('span',d.nombreDeudor+' debe '+dinero(d.importe)+' a '+d.nombreAcreedor),boton('Registrar devolución',()=>{
        deudaActual=d;solicitudDevolucion=crypto.randomUUID();devolucion.reset();devolucion.elements.importe.value=decimal(d.importe);$('detalle-devolucion').textContent=d.nombreDeudor+' devuelve dinero a '+d.nombreAcreedor;$('error-devolucion').textContent='';$('dialogo-devolucion').showModal();
      }));$('lista-saldos').append(fila);
    }
    const devoluciones=movimientos.filter(r=>r.tipo==='devolucion' && (!soloMisSaldos || r.deudor === propia));
    if(!devoluciones.length)$('lista-devoluciones').append(nodo('p','Aún no hay devoluciones registradas.','ayuda-gastos'));
    for(const r of devoluciones){const fila=nodo('div','','fila-saldo');fila.append(nodo('span',r.nombreDeudor+' → '+r.nombreAcreedor+' · '+dinero(r.importe)+' · '+r.fecha),boton('Eliminar registro',async()=>{if(ocupado)return;ocupado=true;try{await solicitarHogares(ruta+'/'+r.id+'/eliminar',{});await cargar();}catch(e){$('estado-gastos').textContent=e.message;}finally{ocupado=false;}}));$('lista-devoluciones').append(fila);}
  }
  function abrir(gasto=null) {
    editando=gasto;solicitud=gasto?.id||crypto.randomUUID();form.reset();$('error-gasto').textContent='';
    $('titulo-dialogo-gasto').textContent=(gasto?'Editar gasto':'Añadir gasto')+' · '+hogar.moneda;
    form.elements.concepto.value=gasto?.concepto||'';form.elements.importe.value=gasto?decimal(gasto.importe):'';
    const hoy=new Date();form.elements.fecha.value=gasto?.fecha||new Intl.DateTimeFormat('sv-SE').format(hoy);
    form.elements.pagador.replaceChildren(...hogar.miembros.map(m=>new Option(m.nombre,m.id,false,m.id===(gasto?.pagador||hogar.miembros.find(m=>m.propia)?.id))));
    // Preserve exact allocations when reopening an existing expense.
    form.elements.modo.value=gasto?'personalizado':'igual';
    $('participantes-gasto').replaceChildren(...hogar.miembros.map(m=>{
      const fila=nodo('div','','participante-gasto'),label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=m.id;check.checked=gasto?gasto.reparto.some(p=>p.id===m.id):true;
      const cantidad=document.createElement('input');cantidad.inputMode='decimal';cantidad.placeholder='0,00';cantidad.setAttribute('aria-label','Parte de '+m.nombre);cantidad.value=gasto?decimal(gasto.reparto.find(p=>p.id===m.id)?.importe||0):'';
      label.append(check,document.createTextNode(m.nombre));fila.append(label,cantidad);return fila;
    }));actualizarReparto();dialogo.showModal();
  }
  function actualizarReparto(){const personalizado=form.elements.modo.value==='personalizado';let seleccionados=0;for(const fila of $('participantes-gasto').children){const [check,cantidad]=fila.querySelectorAll('input');cantidad.hidden=!personalizado;cantidad.disabled=!check.checked;cantidad.required=personalizado&&check.checked;if(check.checked)seleccionados++;}$('resumen-reparto').textContent=personalizado?'La suma de las partes debe coincidir con el total.':'Reparto entre '+seleccionados+' compañeros. Los céntimos sobrantes se distribuyen de uno en uno.';}
  form.addEventListener('change',actualizarReparto);
  $('nuevo-gasto').addEventListener('click',()=>abrir());$('cancelar-gasto').addEventListener('click',()=>{if(!ocupado)dialogo.close();});
  form.addEventListener('submit',async e=>{e.preventDefault();if(ocupado)return;ocupado=true;const guardar=form.querySelector('[type=submit]');guardar.disabled=true;
    const datos=Object.fromEntries(new FormData(form));datos.id=solicitud;datos.nuevo=!editando;datos.tipo='gasto';datos.personalizado=form.elements.modo.value==='personalizado';datos.reparto=[...$('participantes-gasto').children].filter(f=>f.querySelector('input').checked).map(f=>{const [c,i]=f.querySelectorAll('input');return {id:c.value,importe:i.value};});
    try{await solicitarHogares(ruta,datos);dialogo.close();await cargar();}catch(e){$('error-gasto').textContent=e.message;}finally{ocupado=false;guardar.disabled=false;}
  });
  $('cancelar-devolucion').addEventListener('click',()=>{if(!ocupado)$('dialogo-devolucion').close();});
  devolucion.addEventListener('submit',async e=>{e.preventDefault();if(ocupado)return;ocupado=true;const b=devolucion.querySelector('[type=submit]');b.disabled=true;
    try{await solicitarHogares(ruta,{id:solicitudDevolucion,nuevo:true,tipo:'devolucion',deudor:deudaActual.deudor,acreedor:deudaActual.acreedor,importe:devolucion.elements.importe.value});$('dialogo-devolucion').close();await cargar();}catch(e){$('error-devolucion').textContent=e.message;}finally{ocupado=false;b.disabled=false;}
  });
  for(const nombre of ['gastos','saldos'])$('ver-'+nombre).addEventListener('click',()=>{for(const v of ['gastos','saldos']){$('vista-'+v).hidden=v!==nombre;$('ver-'+v).setAttribute('aria-pressed',String(v===nombre));}cargar();});
  for (const [id, soloMios] of [['todos-saldos', false], ['mis-saldos', true]]) {
    $(id).addEventListener('click', () => {
      soloMisSaldos = soloMios;
      $('todos-saldos').setAttribute('aria-pressed', String(!soloMios));
      $('mis-saldos').setAttribute('aria-pressed', String(soloMios));
      render();
    });
  }
  $('enlace-gastos-inicio').addEventListener('click', () => $('ver-saldos').click());
  window.addEventListener('hashchange',()=>{if(['#gastos','#inicio',''].includes(location.hash))cargar();});
  window.addEventListener('focus',()=>{if(['#gastos','#inicio',''].includes(location.hash)&&!ocupado)cargar();});
  for(const d of [dialogo,$('dialogo-devolucion')])d.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
  cargar();
}
