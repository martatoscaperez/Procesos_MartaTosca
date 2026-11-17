import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { crearConexion } from '../servidor/conexion.js';
import { crearRepositorioHogaresPostgres } from '../servidor/datos-hogares.js';
import { crearServicioHogares } from '../servidor/hogares.js';

test('PostgreSQL conserva pisos, membresías y permisos usando tablas temporales', {
  skip: !process.env.DATABASE_URL
}, async () => {
  const conexion = crearConexion();
  let cliente;
  try {
    cliente = await conexion.connect();
    await cliente.query('BEGIN');
      await cliente.query('DISCARD TEMP');
    await cliente.query("CREATE TEMP TABLE usuarios (email TEXT PRIMARY KEY, nombre TEXT NOT NULL, estado TEXT NOT NULL)");
    await cliente.query(`INSERT INTO usuarios VALUES
      ('marta@example.com','Marta','activo'), ('alex@example.com','Álex','activo')`);
    const sql = await readFile(new URL('../servidor/migracion-hogares.sql', import.meta.url), 'utf8');
    await cliente.query(sql.replaceAll('public.', '').replaceAll('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'));
    const conexionTemporal = {
      query: (texto, valores) => cliente.query(texto.replaceAll('public.', 'pg_temp.'), valores),
      connect: async () => ({
        query: (texto, valores) => cliente.query(({BEGIN:'SAVEPOINT operacion_hogar',COMMIT:'RELEASE SAVEPOINT operacion_hogar',ROLLBACK:'ROLLBACK TO SAVEPOINT operacion_hogar'})[texto] ?? texto.replaceAll('public.', 'pg_temp.'), valores),
        release() {}
      })
    };
    let ahora = new Date('2026-11-09T12:00:00Z');
    const servicio = crearServicioHogares(crearRepositorioHogaresPostgres(conexionTemporal), () => ahora);
    const solicitud = randomUUID();
    const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1kAAAAASUVORK5CYII=';
    const hogar = await servicio.crear('marta@example.com', 'Piso plaza', solicitud, { moneda: 'GBP', foto });
    const repetido = await servicio.crear('marta@example.com', 'Piso plaza', solicitud);
    assert.equal(hogar.id, repetido.id);
    assert.equal(repetido.invitacion, null);
    await assert.rejects(servicio.consultar(hogar.id, 'alex@example.com'), { status: 404 });
    await servicio.unir('alex@example.com', hogar.invitacion.codigo);
    await servicio.unir('alex@example.com', hogar.invitacion.codigo);
    let piso = await servicio.consultar(hogar.id, 'alex@example.com');
    assert.equal(piso.miembros.length, 2);
    assert.equal(piso.rol, 'miembro');
    assert.equal(piso.moneda, 'GBP');
    assert.equal(piso.foto, foto);
    const alex = piso.miembros.find(miembro => miembro.propia);
    const { hoy } = await servicio.tareas(hogar.id, 'alex@example.com');
    await servicio.crearTarea(hogar.id, 'marta@example.com', {
      titulo: 'Limpiar la cocina', limite: hoy, responsable: alex.id
    });
    const { tareas: [tarea] } = await servicio.tareas(hogar.id, 'alex@example.com');
    assert.equal(tarea.propia, true);
    await assert.rejects(servicio.completarTarea(hogar.id, 'marta@example.com', tarea.id), { status: 404 });
    await servicio.completarTarea(hogar.id, 'alex@example.com', tarea.id, foto);
    await servicio.completarTarea(hogar.id, 'alex@example.com', tarea.id, foto);
    const tareaConFoto = (await servicio.tareas(hogar.id, 'marta@example.com')).tareas.find(item => item.id === tarea.id);
    assert.equal(tareaConFoto.foto, foto);
    assert.equal(tareaConFoto.completada, hoy);
    assert.equal((await servicio.tareas(hogar.id, 'alex@example.com')).puntos, 1);
    await servicio.ocultarTarea(hogar.id, 'marta@example.com', tarea.id);
    const historial = await servicio.tareas(hogar.id, 'alex@example.com');
    assert.equal(historial.tareas.some(item => item.id === tarea.id), false);
    assert.equal(historial.puntos, 1);
    await assert.rejects(servicio.renovar(hogar.id, 'alex@example.com'), { status: 403 });
    const nueva = await servicio.renovar(hogar.id, 'marta@example.com');
    await assert.rejects(servicio.unir('alex@example.com', hogar.invitacion.codigo), { status: 400 });
    piso = await servicio.unir('alex@example.com', nueva.codigo);
    assert.equal(piso.miembros.length, 2);
    const marta = piso.miembros.find(miembro => miembro.nombre === 'Marta');
    await servicio.crearTarea(hogar.id, 'marta@example.com', {
      titulo: 'Turno de cocina', limite: hoy, frecuencia: 'semanal', participantes: [marta.id, alex.id]
    });
    const primerTurno = (await servicio.tareas(hogar.id, 'marta@example.com')).tareas
      .find(tarea => tarea.titulo === 'Turno de cocina');
    assert.equal(primerTurno.responsable, 'Marta');
    await servicio.reasignarTarea(hogar.id, 'marta@example.com', primerTurno.id, alex.id);
    ahora = new Date('2026-11-10T12:00:00Z');
    await servicio.tareas(hogar.id, 'marta@example.com');
    const siguienteSemana = await servicio.tareas(hogar.id, 'alex@example.com');
    const rotacion = siguienteSemana.tareas.filter(tarea => tarea.titulo === 'Turno de cocina');
    assert.deepEqual(rotacion.map(tarea => [tarea.responsable, tarea.puntos]), [['Álex', -1], ['Álex', 0]]);
    assert.equal(siguienteSemana.turnos[0].responsable, 'Marta');
  } finally {
    if (cliente) {
      await cliente.query('ROLLBACK');

    }
    cliente?.release();
    await conexion.end();
  }
});
