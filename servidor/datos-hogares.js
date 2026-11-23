import { randomUUID } from 'node:crypto';
import { ErrorHogar } from './hogares.js';

function moverFechaTurno(fecha, diaMes, direccion = 1) {
  const dia = new Date(fecha);
  if (diaMes === null) {
    dia.setUTCDate(dia.getUTCDate() + 7 * direccion);
  } else {
    dia.setUTCMonth(dia.getUTCMonth() + direccion, 1);
    const fin = new Date(dia);
    fin.setUTCMonth(fin.getUTCMonth() + 1, 0);
    dia.setUTCDate(Math.min(diaMes, fin.getUTCDate()));
  }
  return dia.toISOString().slice(0, 10);
}

function siguienteMiembro(participantes, posicion, activos) {
  for (let paso = 0; paso < participantes.length; paso += 1) {
    const indice = (posicion + paso) % participantes.length;
    const miembro = activos.get(participantes[indice]);
    if (miembro) return { miembro, siguiente: (indice + 1) % participantes.length };
  }
  return null;
}

async function enTransaccion(conexion, operacion) {
  const cliente = await conexion.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await operacion(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

export function crearRepositorioHogaresPostgres(conexion) {
  return {
    async listarAvisos(id,email) {
      const {rows}=await conexion.query(
        `SELECT a.id,a.secuencia::text,a.texto,a.creado_en::text AS fecha,a.editado_en IS NOT NULL AS editado,u.nombre,u.foto_perfil AS foto,a.autor_email=$2 AS propio,
          (a.autor_email<>$2 AND a.secuencia>coalesce((SELECT secuencia FROM public.lecturas_avisos WHERE hogar_id=$1 AND usuario_email=$2),0)) AS nuevo
          FROM public.avisos_hogar a JOIN public.usuarios u ON u.email=a.autor_email WHERE a.hogar_id=$1
          AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2) ORDER BY a.secuencia`,[id,email]);
      return {avisos:rows,sinLeer:rows.some(a=>a.nuevo),cursor:rows.at(-1)?.secuencia||'0'};
    },
    async guardarAviso(id,email,aviso,texto,editar) {
      return enTransaccion(conexion,async c=>{
        await c.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE',[id]);
        const {rowCount}=await c.query('SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2',[id,email]);if(!rowCount)return false;
        if(texto===null){const r=await c.query('DELETE FROM public.avisos_hogar WHERE hogar_id=$1 AND id=$2 AND autor_email=$3',[id,aviso,email]);return r.rowCount>0;}
        if(editar){const r=await c.query('UPDATE public.avisos_hogar SET texto=$4,editado_en=now() WHERE hogar_id=$1 AND id=$2 AND autor_email=$3',[id,aviso,email,texto]);return r.rowCount>0;}
        const {rows:[existente]}=await c.query('SELECT hogar_id,autor_email FROM public.avisos_hogar WHERE id=$1',[aviso]);
        if(existente)return existente.hogar_id===id&&existente.autor_email===email;
        await c.query('INSERT INTO public.avisos_hogar (id,hogar_id,autor_email,texto) VALUES ($1,$2,$3,$4)',[aviso,id,email,texto]);return true;
      });
    },
    async leerAvisos(id,email,cursor) {
      await conexion.query(`INSERT INTO public.lecturas_avisos (hogar_id,usuario_email,secuencia)
        SELECT $1,$2,least($3::bigint,coalesce((SELECT max(secuencia) FROM public.avisos_hogar WHERE hogar_id=$1),0))
        WHERE EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
        ON CONFLICT (hogar_id,usuario_email) DO UPDATE SET secuencia=greatest(lecturas_avisos.secuencia,EXCLUDED.secuencia)`,[id,email,cursor]);
    },
    async listarNormas(id,email) {
      const {rows}=await conexion.query('SELECT n.id,n.titulo,n.texto FROM public.normas_hogar n WHERE n.hogar_id=$1 AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2) ORDER BY n.creado_en,n.id',[id,email]);
      return rows;
    },
    async guardarNorma(id,email,norma,datos) {
      return enTransaccion(conexion,async c=>{
        await c.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE',[id]);
        const {rowCount}=await c.query("SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2 AND rol='administrador' FOR UPDATE",[id,email]);
        if(!rowCount)return false;
        if(datos) {
          const r=await c.query('INSERT INTO public.normas_hogar (id,hogar_id,titulo,texto) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET titulo=EXCLUDED.titulo,texto=EXCLUDED.texto WHERE normas_hogar.hogar_id=EXCLUDED.hogar_id',[norma,id,datos.titulo,datos.texto]);
          return r.rowCount>0;
        }
        await c.query('DELETE FROM public.normas_hogar WHERE hogar_id=$1 AND id=$2',[id,norma]);return true;
      });
    },
    modificarTareaPendiente(id,email,tarea,datos,hoy) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE',[id]);
        const {rows: miembros} = await cliente.query("SELECT m.id,m.usuario_email FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email WHERE m.hogar_id=$1 AND u.estado='activo'",[id]);
        const destino=miembros.find(m=>m.id===datos.responsable);
        if (!destino || !miembros.some(m=>m.usuario_email===email)) return false;
        const {rows:[actual]}=await cliente.query('SELECT * FROM public.tareas_hogar WHERE hogar_id=$1 AND id=$2 AND completada_el IS NULL AND (fecha_limite IS NULL OR fecha_limite >= $3) FOR UPDATE',[id,tarea,hoy]);
        if (!actual) return false;
        let turno=actual.turno_id;
        let participantes=[destino.id];
        if(turno && actual.responsable_email===destino.usuario_email) {
          const {rows:[anterior]}=await cliente.query('SELECT participantes FROM public.turnos_hogar WHERE id=$1',[turno]);
          if(anterior?.participantes.includes(destino.id)) {
            const indice=anterior.participantes.indexOf(destino.id);
            participantes=[...anterior.participantes.slice(indice),...anterior.participantes.slice(0,indice)];
          }
        }
        if (turno) {
          // Stop the previous schedule while retaining every historical task.
          await cliente.query('UPDATE public.tareas_hogar SET turno_id=NULL WHERE turno_id=$1',[turno]);
          await cliente.query('DELETE FROM public.turnos_hogar WHERE id=$1',[turno]);
        }
        turno=null;
        if(datos.frecuencia!=='puntual') {
          turno=randomUUID();
          const dia=datos.frecuencia==='mensual'?Number(datos.limite.slice(-2)):null;
          await cliente.query('INSERT INTO public.turnos_hogar (id,hogar_id,titulo,participantes,siguiente_fecha,siguiente_posicion,dia_mes) VALUES ($1,$2,$3,$4,$5,$7,$6)',[turno,id,datos.titulo,participantes,moverFechaTurno(datos.limite,dia),dia,1 % participantes.length]);
        }
        await cliente.query('UPDATE public.tareas_hogar SET titulo=$3,fecha_limite=$4,responsable_email=$5,turno_id=$6 WHERE hogar_id=$1 AND id=$2',[id,tarea,datos.titulo,datos.limite,destino.usuario_email,turno]);
        return true;
      });
    },
    async renombrarTareaPendiente(id, email, tarea, titulo) {
      const resultado = await conexion.query(
        `UPDATE public.tareas_hogar SET titulo=$4 WHERE hogar_id=$1 AND id=$3 AND completada_el IS NULL
         AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, tarea, titulo]);
      return resultado.rowCount > 0;
    },
    crearSorteo(id, email, tareas) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rows: miembros } = await cliente.query(
          `SELECT m.id,m.usuario_email FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email
           WHERE m.hogar_id=$1 AND u.estado='activo'`, [id]);
        if (!miembros.some(miembro => miembro.usuario_email === email) ||
            tareas.some(tarea => !miembros.some(miembro => miembro.id === tarea.responsable))) return false;
        for (const tarea of tareas) {
          const responsable = miembros.find(miembro => miembro.id === tarea.responsable).usuario_email;
          await cliente.query(
            `INSERT INTO public.tareas_hogar (id,hogar_id,responsable_email,titulo,fecha_limite)
             VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
            [tarea.id, id, responsable, tarea.titulo, tarea.limite]);
        }
        return true;
      });
    },
    async modificarListaCompra(id, email, lista, nombre) {
      const permiso = 'hogar_id=$1 AND id=$2 AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$3)';
      const resultado = nombre === null
        ? await conexion.query('DELETE FROM public.listas_compra WHERE ' + permiso, [id, lista, email])
        : await conexion.query('UPDATE public.listas_compra SET nombre=$4 WHERE ' + permiso, [id, lista, email, nombre]);
      return resultado.rowCount > 0;
    },
    async modificarProductoCompra(id, email, lista, producto, comprado) {
      const resultado = await conexion.query(
        `UPDATE public.listas_compra l SET productos=(
          SELECT coalesce(jsonb_agg(
            CASE WHEN item->>'id'=$4 THEN item || jsonb_build_object('comprado',$5::boolean) ELSE item END
            ORDER BY posicion), '[]'::jsonb)
          FROM jsonb_array_elements(l.productos) WITH ORDINALITY AS p(item,posicion)
          WHERE $5::boolean IS NOT NULL OR item->>'id'<>$4)
         WHERE hogar_id=$1 AND id=$3
         AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, lista, producto, comprado]);
      return resultado.rowCount > 0;
    },
    async listasCompra(id, email) {
      const { rows } = await conexion.query(
        `SELECT id,nombre,productos FROM public.listas_compra WHERE hogar_id=$1
         AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
         ORDER BY creado_en,id`, [id, email]);
      return rows;
    },
    async guardarListaCompra(id, email, lista) {
      const resultado = await conexion.query(
        `INSERT INTO public.listas_compra (id,hogar_id,nombre,productos)
         SELECT $3,$1,$4,$5::jsonb WHERE EXISTS
         (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
         ON CONFLICT (id) DO NOTHING`,
        [id, email, lista.id, lista.nombre, JSON.stringify(lista.productos)]);
      if (resultado.rowCount) return true;
      const existente = await conexion.query('SELECT id FROM public.listas_compra WHERE id=$1 AND hogar_id=$2', [lista.id, id]);
      return existente.rowCount > 0;
    },
    async agregarProductoCompra(id, email, lista, producto) {
      const resultado = await conexion.query(
        `UPDATE public.listas_compra SET productos=productos || $4::jsonb
         WHERE hogar_id=$1 AND id=$3 AND NOT productos @> $5::jsonb
         AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, lista, JSON.stringify([producto]), JSON.stringify([{ id: producto.id }])]);
      if (resultado.rowCount) return true;
      const existente = await conexion.query(
        `SELECT id FROM public.listas_compra WHERE hogar_id=$1 AND id=$2 AND productos @> $3::jsonb`,
        [id, lista, JSON.stringify([{ id: producto.id }])]);
      return existente.rowCount > 0;
    },
    async eventos(id, email) {
      const { rows } = await conexion.query(
        `SELECT e.id,e.titulo,e.fecha::text,e.hora::text,e.descripcion,u.nombre AS autor,
         e.autor_email=$2 AS propia FROM public.eventos_hogar e JOIN public.usuarios u ON u.email=e.autor_email
         WHERE e.hogar_id=$1 AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
         ORDER BY e.fecha,e.hora NULLS FIRST,e.id`, [id, email]);
      return rows;
    },
    async guardarEvento(id, email, evento, editar) {
      const resultado = editar
        ? await conexion.query(
          `UPDATE public.eventos_hogar SET titulo=$4,fecha=$5,hora=$6,descripcion=$7
           WHERE hogar_id=$1 AND autor_email=$2 AND id=$3 AND EXISTS
           (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
          [id, email, evento.id, evento.titulo, evento.fecha, evento.hora, evento.descripcion])
        : await conexion.query(
          `INSERT INTO public.eventos_hogar (hogar_id,autor_email,id,titulo,fecha,hora,descripcion)
           SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS
           (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
          [id, email, evento.id, evento.titulo, evento.fecha, evento.hora, evento.descripcion]);
      return resultado.rowCount > 0;
    },
    async eliminarEvento(id, email, evento) {
      const resultado = await conexion.query(
        `DELETE FROM public.eventos_hogar WHERE hogar_id=$1 AND autor_email=$2 AND id=$3
         AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, evento]);
      return resultado.rowCount > 0;
    },
    crear(hogar, email, invitacion) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT email FROM public.usuarios WHERE email=$1 FOR UPDATE', [email]);
        const { rows: duplicados } = await cliente.query(
          `SELECT id FROM public.hogares WHERE creador_email=$1
           AND lower(btrim(nombre))=lower(btrim($2)) AND solicitud<>$3`,
          [email, hogar.nombre, hogar.solicitud]
        );
        if (duplicados.length) throw new ErrorHogar('Ya tienes un piso con ese nombre.', 409);
        const { rows: [creado] } = await cliente.query(
          `INSERT INTO public.hogares (id, nombre, creador_email, solicitud, moneda, foto) VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (creador_email, solicitud) DO NOTHING RETURNING id, nombre`,
          [hogar.id, hogar.nombre, email, hogar.solicitud, hogar.moneda, hogar.foto]
        );
        if (!creado) {
          const { rows: [existente] } = await cliente.query(
            'SELECT id, nombre FROM public.hogares WHERE creador_email=$1 AND solicitud=$2',
            [email, hogar.solicitud]
          );
          return { ...existente, rol: 'administrador', nuevo: false };
        }
        await cliente.query(
          "INSERT INTO public.membresias_hogar (hogar_id,usuario_email,rol) VALUES ($1,$2,'administrador')",
          [hogar.id, email]
        );
        await cliente.query(
          'INSERT INTO public.invitaciones_hogar (hogar_id,token_hash,caduca_en) VALUES ($1,$2,$3)',
          [hogar.id, invitacion.hash, invitacion.caduca]
        );
        return { ...creado, rol: 'administrador', nuevo: true };
      });
    },
    async editarPerfil(id, email, cambios) {
      const { rowCount } = await conexion.query(
        `UPDATE public.hogares h SET nombre=$3,
         foto=CASE WHEN $4::boolean THEN $5::text ELSE h.foto END
         WHERE h.id=$1 AND EXISTS (SELECT 1 FROM public.membresias_hogar m
           WHERE m.hogar_id=h.id AND m.usuario_email=$2 AND m.rol='administrador')`,
        [id, email, cambios.nombre, Object.hasOwn(cambios, 'foto'), cambios.foto ?? null]
      );
      return rowCount === 1;
    },
    async listar(email) {
      const { rows } = await conexion.query(
        `SELECT h.id,h.nombre,m.rol,h.creador_email=$1 AS propio FROM public.hogares h
         JOIN public.membresias_hogar m ON m.hogar_id=h.id WHERE m.usuario_email=$1
         ORDER BY h.creado_en,h.id`, [email]
      );
      return rows;
    },
    async consultar(id, email) {
      const { rows: [hogar] } = await conexion.query(
        `SELECT h.id,h.nombre,h.moneda,h.foto,m.rol FROM public.hogares h
         JOIN public.membresias_hogar m ON m.hogar_id=h.id
         WHERE h.id=$1 AND m.usuario_email=$2`, [id, email]
      );
      if (!hogar) return null;
      const { rows: miembros } = await conexion.query(
        `SELECT m.id,u.nombre,u.foto_perfil AS foto,m.rol,m.usuario_email=$2 AS propia FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email
         WHERE m.hogar_id=$1 AND u.estado='activo' ORDER BY m.incorporado_en,m.usuario_email`, [id, email]
      );
      return { ...hogar, miembros };
    },
    async prepararTurnos(id, email, hoy) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rows: miembros } = await cliente.query(
          `SELECT m.id,m.usuario_email,u.nombre FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email
           WHERE m.hogar_id=$1 AND u.estado='activo'`, [id]
        );
        if (!miembros.some(miembro => miembro.usuario_email === email)) return [];
        const activos = new Map(miembros.map(miembro => [miembro.id, miembro]));
        const { rows: turnos } = await cliente.query(
          `SELECT id,titulo,participantes,siguiente_fecha::text,siguiente_posicion,dia_mes
           FROM public.turnos_hogar WHERE hogar_id=$1`, [id]
        );
        const proximos = [];
        for (const turno of turnos) {
          let fecha = turno.siguiente_fecha;
          let posicion = turno.siguiente_posicion;
          let siguiente = siguienteMiembro(turno.participantes, posicion, activos);
          let generadas = 0;
          while (siguiente && moverFechaTurno(fecha, turno.dia_mes, -1) < hoy && generadas < 52) {
            await cliente.query(
              `INSERT INTO public.tareas_hogar (id,hogar_id,responsable_email,titulo,fecha_limite,turno_id)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (turno_id,fecha_limite) DO NOTHING`,
              [randomUUID(), id, siguiente.miembro.usuario_email, turno.titulo, fecha, turno.id]
            );
            fecha = moverFechaTurno(fecha, turno.dia_mes);
            posicion = siguiente.siguiente;
            siguiente = siguienteMiembro(turno.participantes, posicion, activos);
            generadas += 1;
          }
          if (generadas) await cliente.query(
            'UPDATE public.turnos_hogar SET siguiente_fecha=$2,siguiente_posicion=$3 WHERE id=$1',
            [turno.id, fecha, posicion]
          );
          proximos.push({ titulo: turno.titulo, fecha, responsable: siguiente?.miembro.nombre ?? null });
        }
        return proximos;
      });
    },
    async listarTareas(id, email) {
      const { rows } = await conexion.query(
        `SELECT t.id,t.titulo,t.fecha_limite::text AS limite,t.completada_el::text AS completada,
                coalesce((SELECT CASE WHEN r.dia_mes IS NULL THEN 'semanal' ELSE 'mensual' END FROM public.turnos_hogar r WHERE r.id=t.turno_id),'puntual') AS frecuencia, t.oculta,t.foto,t.comentarios,u.nombre AS responsable,t.responsable_email=$2 AS propia,
                (SELECT m.id FROM public.membresias_hogar m WHERE m.hogar_id=t.hogar_id AND m.usuario_email=t.responsable_email) AS "responsableId"
         FROM public.tareas_hogar t JOIN public.usuarios u ON u.email=t.responsable_email
         WHERE t.hogar_id=$1 AND EXISTS (
           SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2
         ) ORDER BY t.fecha_limite,t.id`, [id, email]
      );
      return rows;
    },
    crearTurno(id, email, tarea) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rows: miembros } = await cliente.query(
          `SELECT m.id,m.usuario_email,m.rol FROM public.membresias_hogar m
           JOIN public.usuarios u ON u.email=m.usuario_email
           WHERE m.hogar_id=$1 AND u.estado='activo'`, [id]
        );
        const autor = miembros.find(miembro => miembro.usuario_email === email);
        if (!autor) return false;
        const participantes = tarea.participantes ?? [autor.id];
        if (!participantes.every(idMiembro => miembros.some(miembro => miembro.id === idMiembro))) return false;
        const primero = miembros.find(miembro => miembro.id === participantes[0]);
        await cliente.query(
          `INSERT INTO public.turnos_hogar (id,hogar_id,titulo,participantes,siguiente_fecha,siguiente_posicion,dia_mes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
            tarea.id, id, tarea.titulo, participantes, moverFechaTurno(tarea.limite, tarea.diaMes),
            1 % participantes.length, tarea.diaMes
          ]
        );
        await cliente.query(
          `INSERT INTO public.tareas_hogar (id,hogar_id,responsable_email,titulo,fecha_limite,turno_id)
           VALUES ($1,$2,$3,$4,$5,$6)`, [randomUUID(), id, primero.usuario_email, tarea.titulo, tarea.limite, tarea.id]
        );
        return true;
      });
    },
    async reasignarTarea(id, email, tarea, responsable, hoy) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rowCount } = await cliente.query(
          `UPDATE public.tareas_hogar t SET responsable_email=destino.usuario_email
           FROM public.membresias_hogar autor, public.membresias_hogar destino
           JOIN public.usuarios u ON u.email=destino.usuario_email
           WHERE t.hogar_id=$1 AND t.id=$3 AND t.completada_el IS NULL AND t.fecha_limite >= $5
             AND autor.hogar_id=$1 AND autor.usuario_email=$2
             AND destino.hogar_id=$1 AND destino.id=$4 AND u.estado='activo'`,
          [id, email, tarea, responsable, hoy]
        );
        return Boolean(rowCount);
      });
    },
    crearTarea(id, email, tarea) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rowCount } = await cliente.query(
          `INSERT INTO public.tareas_hogar (id,hogar_id,responsable_email,titulo,fecha_limite)
           SELECT $3,$1,destino.usuario_email,$4,$5
           FROM public.membresias_hogar autor
           JOIN public.membresias_hogar destino ON destino.hogar_id=autor.hogar_id
           JOIN public.usuarios u ON u.email=destino.usuario_email
           WHERE autor.hogar_id=$1 AND autor.usuario_email=$2 AND u.estado='activo'
             AND (($6::uuid IS NULL AND destino.usuario_email=$2)
               OR destino.id=$6)`,
          [id, email, tarea.id, tarea.titulo, tarea.limite, tarea.responsable]
        );
        return Boolean(rowCount);
      });
    },
    async eliminarTarea(id, email, tarea, hoy) {
      const { rowCount } = await conexion.query(
        `WITH ocultada AS (
           UPDATE public.tareas_hogar SET oculta=TRUE
           WHERE hogar_id=$1 AND id=$3 AND completada_el IS NOT NULL
             AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
           RETURNING id
         ), eliminada AS (
           DELETE FROM public.tareas_hogar
           WHERE hogar_id=$1 AND id=$3 AND completada_el IS NULL AND (fecha_limite IS NULL OR fecha_limite >= $4)
             AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)
           RETURNING id
         )
         SELECT id FROM ocultada UNION ALL SELECT id FROM eliminada`,
        [id, email, tarea, hoy]
      );
      return rowCount > 0;
    },
    async ocultarTarea(id, email, tarea) {
      const { rowCount } = await conexion.query(
        `UPDATE public.tareas_hogar SET oculta=TRUE
         WHERE hogar_id=$1 AND id=$3 AND completada_el IS NOT NULL
           AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, tarea]
      );
      return Boolean(rowCount);
    },
    async editarTareaHecha(id, email, tarea, titulo) {
      const { rowCount } = await conexion.query(
        `UPDATE public.tareas_hogar SET titulo=$4
         WHERE hogar_id=$1 AND id=$3 AND completada_el IS NOT NULL
           AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, tarea, titulo]
      );
      return Boolean(rowCount);
    },
    async completarTarea(id, email, tarea, hoy, foto) {
      const { rowCount } = await conexion.query(
        `UPDATE public.tareas_hogar SET completada_el=COALESCE(completada_el,$4),
           foto=CASE WHEN completada_el IS NULL THEN $5 ELSE foto END
         WHERE hogar_id=$1 AND responsable_email=$2 AND id=$3
           AND (completada_el IS NULL OR foto IS NOT DISTINCT FROM $5)
           AND EXISTS (SELECT 1 FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2)`,
        [id, email, tarea, hoy, foto]
      );
      return Boolean(rowCount);
    },
    async comentarTarea(id, email, tarea, texto) {
      const { rowCount } = await conexion.query(
        `UPDATE public.tareas_hogar t
         SET comentarios=t.comentarios || jsonb_build_array(jsonb_build_object('autor',u.nombre,'texto',$4::text))
         FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email
         WHERE t.hogar_id=$1 AND t.id=$3 AND t.completada_el IS NOT NULL AND t.foto IS NOT NULL
           AND m.hogar_id=t.hogar_id AND m.usuario_email=$2 AND u.estado='activo'`,
        [id, email, tarea, texto]
      );
      return Boolean(rowCount);
    },
    unir(hash, email, ahora) {
      return enTransaccion(conexion, async cliente => {
        const { rows: [invitacion] } = await cliente.query(
          'SELECT hogar_id FROM public.invitaciones_hogar WHERE token_hash=$1 AND caduca_en>$2 FOR UPDATE',
          [hash, ahora]
        );
        if (!invitacion) return null;
        await cliente.query(
          `INSERT INTO public.membresias_hogar (hogar_id,usuario_email,rol) VALUES ($1,$2,'miembro')
           ON CONFLICT (hogar_id,usuario_email) DO NOTHING`, [invitacion.hogar_id, email]
        );
        return invitacion.hogar_id;
      });
    },
    abandonar(id, email) {
      return enTransaccion(conexion, async cliente => {
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rows: [membresia] } = await cliente.query(
          'SELECT rol FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2', [id, email]
        );
        if (!membresia) return;
        if (membresia.rol === 'administrador') {
          const { rowCount } = await cliente.query(
            `SELECT 1 FROM public.membresias_hogar m JOIN public.usuarios u ON u.email=m.usuario_email
             WHERE m.hogar_id=$1 AND m.usuario_email<>$2 AND m.rol='administrador' AND u.estado='activo' LIMIT 1`,
            [id, email]
          );
          if (!rowCount) return 'administrador';
        }
        await cliente.query('DELETE FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2', [id, email]);
      });
    },
    renovar(id, email, invitacion) {
      return enTransaccion(conexion, async cliente => {
        const { rows: [miembro] } = await cliente.query(
          `SELECT rol FROM public.membresias_hogar WHERE hogar_id=$1 AND usuario_email=$2 FOR UPDATE`,
          [id, email]
        );
        if (miembro?.rol !== 'administrador') return false;
        await cliente.query(
          `INSERT INTO public.invitaciones_hogar (hogar_id,token_hash,caduca_en) VALUES ($1,$2,$3)
           ON CONFLICT (hogar_id) DO UPDATE SET token_hash=$2,caduca_en=$3`,
          [id, invitacion.hash, invitacion.caduca]
        );
        return true;
      });
    }
  };
}

export function crearRepositorioHogaresMemoria(usuarios) {
  const avisos = new Map(), lecturas = new Map();
  let secuenciaAvisos=0;
  const normas = new Map();
  const listasCompra = new Map();
  const eventos = new Map();
  const hogares = new Map();
  const tareas = new Map();
  const turnos = new Map();
  const identificadores = new Map();
  function idMiembro(hogar, email) {
    const clave = `${hogar}:${email}`;
    if (!identificadores.has(clave)) identificadores.set(clave, randomUUID());
    return identificadores.get(clave);
  }
  return {
    async listarAvisos(id,email) {
      if(!hogares.get(id)?.miembros.has(email))return {avisos:[],sinLeer:false,cursor:'0'};
      const lista=await Promise.all((avisos.get(id)||[]).map(async a=>{
        const usuario = await usuarios.buscarPorEmail(a.autor);
        return {...a,nombre:usuario.nombre,foto:usuario.foto??null,propio:a.autor===email,nuevo:a.autor!==email&&Number(a.secuencia)>(lecturas.get(id+email)||0)};
      }));
      return {avisos:lista,sinLeer:lista.some(a=>a.nuevo),cursor:lista.at(-1)?.secuencia||'0'};
    },
    async guardarAviso(id,email,aviso,texto,editar) {
      if(!hogares.get(id)?.miembros.has(email))return false;
      if(!avisos.has(id))avisos.set(id,[]);const lista=avisos.get(id),actual=lista.find(a=>a.id===aviso);
      if(actual){if(actual.autor!==email)return false;if(texto===null)lista.splice(lista.indexOf(actual),1);else if(editar){actual.texto=texto;actual.editado=true;}return true;}
      if(editar||texto===null)return false;
      lista.push({id:aviso,autor:email,texto,secuencia:String(++secuenciaAvisos),fecha:new Date().toISOString(),editado:false});return true;
    },
    async leerAvisos(id,email,cursor) {
      if(!hogares.get(id)?.miembros.has(email))return;
      const max=Number(avisos.get(id)?.at(-1)?.secuencia||0);lecturas.set(id+email,Math.max(lecturas.get(id+email)||0,Math.min(Number(cursor),max)));
    },
    async listarNormas(id,email) {return hogares.get(id)?.miembros.has(email)?structuredClone(normas.get(id)||[]):[];},
    async guardarNorma(id,email,norma,datos) {
      if(hogares.get(id)?.miembros.get(email)!=='administrador')return false;
      if(!normas.has(id))normas.set(id,[]);
      const lista=normas.get(id),indice=lista.findIndex(n=>n.id===norma);
      if(datos){const registro={id:norma,...datos};if(indice<0)lista.push(registro);else lista[indice]=registro;}
      else if(indice>=0)lista.splice(indice,1);
      return true;
    },
    async modificarTareaPendiente(id,email,tarea,datos,hoy) {
      const miembros=hogares.get(id)?.miembros;
      const destino=miembros && [...miembros.keys()].find(m=>idMiembro(id,m)===datos.responsable);
      const actual=tareas.get(id)?.find(t=>t.id===tarea);
      if(!miembros?.has(email)||!destino||!actual||actual.completada||(actual.limite && actual.limite<hoy)) return false;
      const anterior=(turnos.get(id)||[]).find(t=>t.id===actual.turnoId);
      let participantes=[datos.responsable];
      if(anterior && actual.emailResponsable===destino && anterior.participantes.includes(datos.responsable)) {
        const indice=anterior.participantes.indexOf(datos.responsable);
        participantes=[...anterior.participantes.slice(indice),...anterior.participantes.slice(0,indice)];
      }
      if(actual.turnoId) turnos.set(id,(turnos.get(id)||[]).filter(t=>t.id!==actual.turnoId));
      Object.assign(actual,{titulo:datos.titulo,limite:datos.limite,emailResponsable:destino,turnoId:null});
      if(datos.frecuencia!=='puntual') {
        actual.turnoId=randomUUID();
        const diaMes=datos.frecuencia==='mensual'?Number(datos.limite.slice(-2)):null;
        if(!turnos.has(id)) turnos.set(id,[]);
        turnos.get(id).push({id:actual.turnoId,titulo:datos.titulo,participantes,diaMes,fecha:moverFechaTurno(datos.limite,diaMes),posicion:1 % participantes.length});
      }
      return true;
    },
    async renombrarTareaPendiente(id, email, tarea, titulo) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      const registro = tareas.get(id)?.find(item => item.id === tarea && !item.completada);
      if (!registro) return false;
      registro.titulo = titulo;
      return true;
    },
    async crearSorteo(id, email, nuevas) {
      const miembros = hogares.get(id)?.miembros;
      if (!miembros?.has(email)) return false;
      const destinos = nuevas.map(tarea => [...miembros.keys()].find(usuario => idMiembro(id, usuario) === tarea.responsable));
      if (destinos.some(destino => !destino)) return false;
      if (!tareas.has(id)) tareas.set(id, []);
      nuevas.forEach((tarea, indice) => {
        if (!tareas.get(id).some(actual => actual.id === tarea.id)) {
          tareas.get(id).push({ ...tarea, emailResponsable: destinos[indice], completada: null });
        }
      });
      return true;
    },
    async modificarListaCompra(id, email, lista, nombre) {
      const guardada = listasCompra.get(id)?.get(lista);
      if (!hogares.get(id)?.miembros.has(email) || !guardada) return false;
      if (nombre === null) listasCompra.get(id).delete(lista);
      else guardada.nombre = nombre;
      return true;
    },
    async modificarProductoCompra(id, email, lista, producto, comprado) {
      const guardada = listasCompra.get(id)?.get(lista);
      if (!hogares.get(id)?.miembros.has(email) || !guardada) return false;
      if (comprado === null) guardada.productos = guardada.productos.filter(item => item.id !== producto);
      else {
        const item = guardada.productos.find(item => item.id === producto);
        if (item) item.comprado = comprado;
      }
      return true;
    },
    async listasCompra(id, email) {
      if (!hogares.get(id)?.miembros.has(email)) return [];
      return structuredClone([...(listasCompra.get(id)?.values() ?? [])]);
    },
    async guardarListaCompra(id, email, lista) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      if (!listasCompra.has(id)) listasCompra.set(id, new Map());
      if (!listasCompra.get(id).has(lista.id)) listasCompra.get(id).set(lista.id, structuredClone(lista));
      return true;
    },
    async agregarProductoCompra(id, email, lista, producto) {
      const guardada = listasCompra.get(id)?.get(lista);
      if (!hogares.get(id)?.miembros.has(email) || !guardada) return false;
      if (!guardada.productos.some(item => item.id === producto.id)) guardada.productos.push(structuredClone(producto));
      return true;
    },
    async eventos(id, email) {
      if (!hogares.get(id)?.miembros.has(email)) return [];
      return Promise.all([...(eventos.get(id)?.values() ?? [])].map(async evento => ({
        ...evento, autorEmail: undefined, propia: evento.autorEmail === email,
        autor: (await usuarios.buscarPorEmail(evento.autorEmail)).nombre
      })));
    },
    async guardarEvento(id, email, evento, editar) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      if (!eventos.has(id)) eventos.set(id, new Map());
      const lista = eventos.get(id);
      if (editar && lista.get(evento.id)?.autorEmail !== email) return false;
      lista.set(evento.id, { ...evento, autorEmail: email });
      return true;
    },
    async eliminarEvento(id, email, evento) {
      if (!hogares.get(id)?.miembros.has(email) || eventos.get(id)?.get(evento)?.autorEmail !== email) return false;
      return eventos.get(id).delete(evento);
    },
    async crear(hogar, email, invitacion) {
      const anterior = [...hogares.values()].find(item =>
        item.creador === email && item.solicitud === hogar.solicitud
      );
      if (anterior) return { id: anterior.id, nombre: anterior.nombre, rol: 'administrador', nuevo: false };
      if ([...hogares.values()].some(item => item.creador === email &&
          item.nombre.trim().toLowerCase() === hogar.nombre.trim().toLowerCase())) {
        throw new ErrorHogar('Ya tienes un piso con ese nombre.', 409);
      }
      hogares.set(hogar.id, { ...hogar, creador: email, invitacion, miembros: new Map([[email, 'administrador']]) });
      return { id: hogar.id, nombre: hogar.nombre, rol: 'administrador', nuevo: true };
    },
    async editarPerfil(id, email, cambios) {
      const hogar = hogares.get(id);
      if (hogar?.miembros.get(email) !== 'administrador') return false;
      hogar.nombre = cambios.nombre;
      if (Object.hasOwn(cambios, 'foto')) hogar.foto = cambios.foto;
      return true;
    },
    async listar(email) {
      return [...hogares.values()].filter(hogar => hogar.miembros.has(email))
        .map(hogar => ({ id: hogar.id, nombre: hogar.nombre, rol: hogar.miembros.get(email), propio: hogar.creador === email }));
    },
    async consultar(id, email) {
      const hogar = hogares.get(id);
      if (!hogar?.miembros.has(email)) return null;
      const miembros = [];
      for (const [emailMiembro, rol] of hogar.miembros) {
        const usuario = await usuarios.buscarPorEmail(emailMiembro);
        if (usuario?.estado === 'activo') miembros.push({
          id: idMiembro(id, emailMiembro), nombre: usuario.nombre, foto: usuario.foto ?? null, rol, propia: email === emailMiembro
        });
      }
      return { id, nombre: hogar.nombre, moneda: hogar.moneda, foto: hogar.foto, rol: hogar.miembros.get(email), miembros };
    },
    async listarTareas(id, email) {
      if (!hogares.get(id)?.miembros.has(email)) return [];
      return Promise.all((tareas.get(id) ?? []).map(async ({ emailResponsable, ...tarea }) => ({
        ...tarea, frecuencia: (turnos.get(id)||[]).find(t=>t.id===tarea.turnoId) ? ((turnos.get(id)||[]).find(t=>t.id===tarea.turnoId).diaMes === null ? 'semanal' : 'mensual') : 'puntual', propia: emailResponsable === email, responsableId: idMiembro(id, emailResponsable),
        responsable: (await usuarios.buscarPorEmail(emailResponsable)).nombre
      })));
    },
    async prepararTurnos(id, email, hoy) {
      const hogar = await this.consultar(id, email);
      if (!hogar) return [];
      const activos = new Map(hogar.miembros.map(miembro => [miembro.id, miembro]));
      return (turnos.get(id) ?? []).map(turno => {
        let siguiente = siguienteMiembro(turno.participantes, turno.posicion, activos);
        for (let generadas = 0; siguiente && moverFechaTurno(turno.fecha, turno.diaMes, -1) < hoy && generadas < 52; generadas++) {
          const responsable = [...hogares.get(id).miembros.keys()].find(
            miembro => idMiembro(id, miembro) === siguiente.miembro.id
          );
          tareas.get(id).push({
            id: randomUUID(), turnoId: turno.id, titulo: turno.titulo, limite: turno.fecha, emailResponsable: responsable, completada: null
          });
          turno.fecha = moverFechaTurno(turno.fecha, turno.diaMes);
          turno.posicion = siguiente.siguiente;
          siguiente = siguienteMiembro(turno.participantes, turno.posicion, activos);
        }
        return { titulo: turno.titulo, fecha: turno.fecha, responsable: siguiente?.miembro.nombre ?? null };
      });
    },
    async crearTurno(id, email, tarea) {
      const hogar = await this.consultar(id, email);
      if (!hogar) return false;
      const propia = idMiembro(id, email);
      const participantes = tarea.participantes ?? [propia];
      if (!participantes.every(id => hogar.miembros.some(miembro => miembro.id === id))) return false;
      if (!await this.crearTarea(id, email, { ...tarea, turnoId: tarea.id, responsable: participantes[0] })) return false;
      if (!turnos.has(id)) turnos.set(id, []);
      turnos.get(id).push({
        id: tarea.id, titulo: tarea.titulo, participantes, diaMes: tarea.diaMes,
        fecha: moverFechaTurno(tarea.limite, tarea.diaMes), posicion: 1 % participantes.length
      });
      return true;
    },
    async reasignarTarea(id, email, tarea, responsable, hoy) {
      const miembros = hogares.get(id)?.miembros;
      if (!miembros?.has(email)) return false;
      const destino = [...miembros.keys()].find(miembro => idMiembro(id, miembro) === responsable);
      const registro = tareas.get(id)?.find(item => item.id === tarea);
      if (!destino || (await usuarios.buscarPorEmail(destino))?.estado !== 'activo' ||
          !miembros.has(destino) || !registro || registro.completada || registro.limite < hoy) return false;
      registro.emailResponsable = destino;
      return true;
    },
    async crearTarea(id, email, tarea) {
      const miembros = hogares.get(id)?.miembros;
      if (!miembros?.has(email)) return false;
      const destino = tarea.responsable === null ? email :
        [...miembros.keys()].find(miembro => idMiembro(id, miembro) === tarea.responsable);
      if (!destino) return false;
      if ((await usuarios.buscarPorEmail(destino))?.estado !== 'activo' ||
          !miembros.has(email) || !miembros.has(destino)) return false;
      if (!tareas.has(id)) tareas.set(id, []);
      tareas.get(id).push({
        id: tarea.id, titulo: tarea.titulo, limite: tarea.limite, emailResponsable: destino, completada: null
      });
      return true;
    },
    async eliminarTarea(id, email, tarea, hoy) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      const lista = tareas.get(id);
      const indice = lista?.findIndex(item => item.id === tarea && (item.completada || !item.limite || item.limite >= hoy)) ?? -1;
      if (indice < 0) return false;
      if (lista[indice].completada) lista[indice].oculta = true;
      else lista.splice(indice, 1);
      return true;
    },
    async ocultarTarea(id, email, tarea) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      const registro = tareas.get(id)?.find(item => item.id === tarea && item.completada);
      if (!registro) return false;
      registro.oculta = true;
      return true;
    },
    async editarTareaHecha(id, email, tarea, titulo) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      const registro = tareas.get(id)?.find(item => item.id === tarea && item.completada);
      if (!registro) return false;
      registro.titulo = titulo;
      return true;
    },
    async completarTarea(id, email, tarea, hoy, foto) {
      if (!hogares.get(id)?.miembros.has(email)) return false;
      const registro = tareas.get(id)?.find(item => item.id === tarea && item.emailResponsable === email);
      if (!registro) return false;
      if (registro.completada) return (registro.foto ?? null) === foto;
      registro.completada ??= hoy;
      registro.foto ??= foto;
      return true;
    },
    async comentarTarea(id, email, tarea, texto) {
      const usuario = await usuarios.buscarPorEmail(email);
      if (usuario?.estado !== 'activo' || !hogares.get(id)?.miembros.has(email)) return false;
      const registro = tareas.get(id)?.find(item => item.id === tarea && item.completada && item.foto);
      if (!registro) return false;
      registro.comentarios ??= [];
      registro.comentarios.push({ autor: usuario.nombre, texto });
      return true;
    },
    async unir(hash, email, ahora) {
      const hogar = [...hogares.values()].find(item => item.invitacion.hash === hash &&
        item.invitacion.caduca > ahora);
      if (!hogar) return null;
      if (!hogar.miembros.has(email)) hogar.miembros.set(email, 'miembro');
      return hogar.id;
    },
    async abandonar(id, email) {
      const hogar = hogares.get(id);
      if (!hogar) return;
      if (hogar.miembros.get(email) === 'administrador') return 'administrador';
      hogar.miembros.delete(email);
    },
    async renovar(id, email, invitacion) {
      const hogar = hogares.get(id);
      if (hogar?.miembros.get(email) !== 'administrador') return false;
      hogar.invitacion = invitacion;
      return true;
    }
  };
}
