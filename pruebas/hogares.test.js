import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { crearRepositorioHogaresMemoria } from '../servidor/datos/datos-hogares.js';
import { crearServicioHogares } from '../servidor/logica/hogares.js';

function preparar() {
  let ahora = new Date('2026-11-05T12:00:00Z');
  const repositorio = crearRepositorioHogaresMemoria({
    buscarPorEmail: async email => ({ nombre: email.split('@')[0], estado: 'activo' })
  });
  return {
    servicio: crearServicioHogares(repositorio, () => ahora),
    avanzar: () => { ahora = new Date('2026-11-13T12:00:00Z'); }
  };
}

test('los avisos muestran la foto actual de cada autor y permiten volver a la inicial', async () => {
  let foto = 'data:image/png;base64,foto-de-prueba';
  const repositorio = crearRepositorioHogaresMemoria({ buscarPorEmail: async email => ({ nombre: email, estado: 'activo', foto: email === 'marta@example.com' ? foto : null }) });
  const servicio = crearServicioHogares(repositorio);
  const hogar = await servicio.crear('marta@example.com', 'Casa', randomUUID());
  await servicio.unir('alex@example.com', hogar.invitacion.codigo);
  await servicio.guardarAviso(hogar.id, 'marta@example.com', randomUUID(), 'Hola');
  await servicio.guardarAviso(hogar.id, 'alex@example.com', randomUUID(), 'Buenas');
  let avisos = (await servicio.avisos(hogar.id, 'alex@example.com')).avisos;
  assert.equal(avisos.find(a => a.nombre === 'marta@example.com').foto, foto);
  assert.equal(avisos.find(a => a.nombre === 'alex@example.com').foto, null);
  foto = null;
  avisos = (await servicio.avisos(hogar.id, 'alex@example.com')).avisos;
  assert.equal(avisos.find(a => a.nombre === 'marta@example.com').foto, null);
});

test('crear, listar y consultar un piso mantiene al creador como administrador y aísla cuentas', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', '  Piso plaza  ', randomUUID());
  assert.equal(hogar.nombre, 'Piso plaza');
  assert.equal(hogar.rol, 'administrador');
  assert.match(hogar.invitacion.codigo, /^[A-F0-9]{20}$/);
  assert.equal((await servicio.listar('marta@example.com')).length, 1);
  assert.deepEqual(await servicio.listar('otra@example.com'), []);
  await assert.rejects(servicio.consultar(hogar.id, 'otra@example.com'), { status: 404 });
  const consultado = await servicio.consultar(hogar.id, 'marta@example.com');
  assert.equal(consultado.miembros.length, 1);
  assert.equal(consultado.invitacion, undefined);
});

test('solo el administrador edita la identidad del piso y los cambios son compartidos', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', 'Casa', randomUUID(), { moneda: 'GBP' });
  await servicio.unir('alex@example.com', hogar.invitacion.codigo);
  await assert.rejects(servicio.editarPerfil(hogar.id, 'alex@example.com', { nombre: 'Otra casa' }), { status: 403 });
  await assert.rejects(servicio.editarPerfil(hogar.id, 'ajeno@example.com', { nombre: 'Otra casa' }), { status: 404 });
  const foto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jO1kAAAAASUVORK5CYII=';
  const actualizado = await servicio.editarPerfil(hogar.id, 'marta@example.com', { nombre: '  Nuestro hogar  ', foto, moneda: 'USD' });
  assert.equal(actualizado.nombre, 'Nuestro hogar');
  assert.equal(actualizado.foto, foto);
  assert.equal(actualizado.moneda, 'GBP');
  assert.equal(actualizado.miembros.length, 2);
  assert.equal((await servicio.listar('alex@example.com'))[0].nombre, 'Nuestro hogar');
  await servicio.editarPerfil(hogar.id, 'marta@example.com', { nombre: 'Casa nueva' });
  assert.equal((await servicio.consultar(hogar.id, 'alex@example.com')).foto, foto);
  await servicio.editarPerfil(hogar.id, 'marta@example.com', { nombre: 'Casa nueva', foto: null });
  assert.equal((await servicio.consultar(hogar.id, 'alex@example.com')).foto, null);
});

test('editar el piso rechaza datos inválidos sin modificar el nombre ni la foto', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', 'Casa', randomUUID());
  for (const datos of [null, {}, { nombre: ' ' }, { nombre: 'a'.repeat(31) },
    { nombre: 'Cambio', foto: 'https://example.com/foto.png' },
    { nombre: 'Cambio', foto: 'data:image/png;base64,aG9sYQ==' }]) {
    await assert.rejects(servicio.editarPerfil(hogar.id, 'marta@example.com', datos), { status: 400 });
  }
  assert.equal((await servicio.consultar(hogar.id, 'marta@example.com')).nombre, 'Casa');
});

test('rechaza nombres repetidos del mismo creador conservando reintentos y nombres de otros usuarios', async () => {
  const { servicio } = preparar();
  const solicitud = randomUUID();
  const hogar = await servicio.crear('marta@example.com', 'Piso plaza', solicitud);
  assert.equal((await servicio.crear('marta@example.com', 'Piso plaza', solicitud)).id, hogar.id);
  await assert.rejects(servicio.crear('marta@example.com', ' PISO PLAZA ', randomUUID()), {
    message: 'Ya tienes un piso con ese nombre.', status: 409
  });
  await servicio.crear('alex@example.com', 'Piso plaza', randomUUID());
  assert.equal((await servicio.listar('marta@example.com')).length, 1);
});

test('calendario compartido conserva eventos y protege la edición por autor y por piso', async () => {
  const { servicio } = preparar();
  const piso = await servicio.crear('marta@example.com', 'Casa', randomUUID());
  await servicio.unir('alex@example.com', piso.invitacion.codigo);
  const datos = { titulo: 'Fontanero', fecha: '2026-11-18', hora: '10:00', descripcion: 'Baño' };
  await servicio.guardarEvento(piso.id, 'marta@example.com', datos);
  const { eventos: [evento] } = await servicio.eventos(piso.id, 'alex@example.com');
  assert.equal(evento.titulo, 'Fontanero');
  assert.equal(evento.propia, false);
  assert.equal(evento.autorEmail, undefined);
  await assert.rejects(servicio.eventos(piso.id, 'otra@example.com'), { status: 404 });
  await assert.rejects(servicio.guardarEvento(piso.id, 'alex@example.com', datos, evento.id), { status: 403 });
  await assert.rejects(servicio.eliminarEvento(piso.id, 'alex@example.com', evento.id), { status: 403 });
  await assert.rejects(servicio.guardarEvento(piso.id, 'marta@example.com', { ...datos, fecha: '2026-02-30' }), { status: 400 });
  await assert.rejects(servicio.guardarEvento(piso.id, 'marta@example.com', { ...datos, hora: '25:00' }), { status: 400 });
  await servicio.guardarEvento(piso.id, 'marta@example.com', { ...datos, titulo: 'Cumpleaños', hora: null }, evento.id);
  const actualizados = await servicio.eventos(piso.id, 'marta@example.com');
  assert.equal(actualizados.eventos[0].titulo, 'Cumpleaños');
  assert.equal(actualizados.eventos[0].hora, null);
  await servicio.eliminarEvento(piso.id, 'marta@example.com', evento.id);
  assert.equal((await servicio.eventos(piso.id, 'marta@example.com')).eventos.length, 0);
});

test('las listas de compra se comparten, aíslan pisos y evitan duplicados al reintentar', async () => {
  const { servicio } = preparar();
  const piso = await servicio.crear('marta@example.com', 'Compra', randomUUID());
  await servicio.unir('alex@example.com', piso.invitacion.codigo);
  const lista = { id: randomUUID(), nombre: 'Supermercado' };
  await servicio.crearListaCompra(piso.id, 'marta@example.com', lista);
  await servicio.crearListaCompra(piso.id, 'marta@example.com', lista);
  const producto = { id: randomUUID(), nombre: 'Leche', cantidad: '2 litros' };
  await Promise.all([
    servicio.agregarProductoCompra(piso.id, 'alex@example.com', lista.id, producto),
    servicio.agregarProductoCompra(piso.id, 'alex@example.com', lista.id, producto)
  ]);
  const guardadas = await servicio.listasCompra(piso.id, 'marta@example.com');
  assert.equal(guardadas.length, 1);
  assert.deepEqual(guardadas[0].productos, [producto]);
  await servicio.modificarProductoCompra(piso.id, 'alex@example.com', lista.id, producto.id, true);
  assert.equal((await servicio.listasCompra(piso.id, 'marta@example.com'))[0].productos[0].comprado, true);
  await servicio.modificarProductoCompra(piso.id, 'marta@example.com', lista.id, producto.id, false);
  assert.equal((await servicio.listasCompra(piso.id, 'alex@example.com'))[0].productos[0].comprado, false);
  await assert.rejects(servicio.modificarProductoCompra(piso.id, 'otra@example.com', lista.id, producto.id, null), { status: 404 });
  await servicio.modificarProductoCompra(piso.id, 'alex@example.com', lista.id, producto.id, null);
  assert.equal((await servicio.listasCompra(piso.id, 'marta@example.com'))[0].productos.length, 0);
  await assert.rejects(servicio.listasCompra(piso.id, 'otra@example.com'), { status: 404 });
  await assert.rejects(servicio.agregarProductoCompra(piso.id, 'marta@example.com', randomUUID(), producto), { status: 404 });
  await assert.rejects(servicio.crearListaCompra(piso.id, 'marta@example.com', { id: randomUUID(), nombre: ' ' }), { status: 400 });
  const automatica = { id: randomUUID(), nombre: 'Compra de hoy', producto: { ...producto, id: randomUUID(), cantidad: '' } };
  await servicio.crearListaCompra(piso.id, 'alex@example.com', automatica);
  assert.equal((await servicio.listasCompra(piso.id, 'alex@example.com'))[1].productos[0].cantidad, '');
});

test('la lotería reparte equilibradamente y reintentar no duplica tareas', async () => {
  const { servicio } = preparar();
  const piso = await servicio.crear('marta@example.com', 'Sorteo', randomUUID());
  await servicio.unir('alex@example.com', piso.invitacion.codigo);
  await servicio.unir('lucas@example.com', piso.invitacion.codigo);
  const hogar = await servicio.consultar(piso.id, 'marta@example.com');
  const datos = {
    solicitud: randomUUID(), titulos: Array.from({ length: 8 }, (_, i) => 'Tarea ' + i),
    limite: '2026-11-10', participantes: hogar.miembros.map(miembro => miembro.id)
  };
  const resultado = await servicio.sortearTareas(piso.id, 'marta@example.com', datos);
  const cantidades = datos.participantes.map(id => resultado.filter(tarea => tarea.responsable === id).length);
  assert.equal(resultado.length, 8);
  assert.equal(Math.max(...cantidades) - Math.min(...cantidades), 1);
  assert.deepEqual(await servicio.sortearTareas(piso.id, 'marta@example.com', datos), resultado);
  assert.equal((await servicio.tareas(piso.id, 'marta@example.com')).tareas.length, 8);
  const sinFecha = await servicio.sortearTareas(piso.id, 'marta@example.com', {
    ...datos, solicitud: randomUUID(), titulos: ['Sin plazo'], limite: ''
  });
  assert.equal(sinFecha[0].limite, null);
  const pendiente = (await servicio.tareas(piso.id, 'marta@example.com')).tareas.find(tarea => tarea.id === sinFecha[0].id);
  assert.equal(pendiente.tarde, false);
  assert.equal(pendiente.puntos, 0);
  await assert.rejects(servicio.sortearTareas(piso.id, 'marta@example.com', { ...datos, participantes: [randomUUID()] }), { status: 400 });
  await assert.rejects(servicio.sortearTareas(piso.id, 'otra@example.com', datos), { status: 404 });
});

test('solo se comentan fotos y no se añaden después de completar la tarea', async () => {
  const { servicio } = preparar();
  const piso = await servicio.crear('marta@example.com', 'Fotos', randomUUID());
  await servicio.crearTarea(piso.id, 'marta@example.com', { titulo: 'Baño', limite: '2026-11-10' });
  const [tarea] = (await servicio.tareas(piso.id, 'marta@example.com')).tareas;
  await servicio.completarTarea(piso.id, 'marta@example.com', tarea.id);
  await assert.rejects(servicio.comentarTarea(piso.id, 'marta@example.com', tarea.id, 'Comentario'), { status: 404 });
  const foto = 'data:image/png;base64,iVBORw0KGgo=';
  await assert.rejects(servicio.completarTarea(piso.id, 'marta@example.com', tarea.id, foto), { status: 404 });
  await servicio.crearTarea(piso.id, 'marta@example.com', { titulo: 'Cocina', limite: '2026-11-10' });
  const nueva = (await servicio.tareas(piso.id, 'marta@example.com')).tareas.find(item => item.titulo === 'Cocina');
  await servicio.completarTarea(piso.id, 'marta@example.com', nueva.id, foto);
  await servicio.completarTarea(piso.id, 'marta@example.com', nueva.id, foto);
  await servicio.comentarTarea(piso.id, 'marta@example.com', nueva.id, '¡Bien!');
  const guardada = (await servicio.tareas(piso.id, 'marta@example.com')).tareas.find(item => item.id === nueva.id);
  assert.equal(guardada.comentarios.length, 1);
});

test('las solicitudes repetidas y simultáneas no duplican pisos ni miembros', async () => {
  const { servicio } = preparar();
  const solicitud = randomUUID();
  const [hogar, repetido] = await Promise.all([
    servicio.crear('marta@example.com', 'Piso', solicitud),
    servicio.crear('marta@example.com', 'Piso', solicitud)
  ]);
  assert.equal(hogar.id, repetido.id);
  assert.equal((await servicio.listar('marta@example.com')).length, 1);
  const codigo = hogar.invitacion.codigo;
  await Promise.all([
    servicio.unir('alex@example.com', codigo.toLowerCase()),
    servicio.unir('alex@example.com', codigo)
  ]);
  await servicio.unir('marta@example.com', codigo);
  const piso = await servicio.consultar(hogar.id, 'marta@example.com');
  assert.equal(piso.miembros.length, 2);
  assert.equal(piso.miembros[0].rol, 'administrador');
  assert.equal((await servicio.listar('alex@example.com'))[0].rol, 'miembro');
});

test('solo el administrador renueva el código y el anterior queda invalidado', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', 'Piso', randomUUID());
  await servicio.unir('alex@example.com', hogar.invitacion.codigo);
  await assert.rejects(servicio.renovar(hogar.id, 'alex@example.com'), { status: 403 });
  await assert.rejects(servicio.renovar(hogar.id, 'ajena@example.com'), { status: 403 });
  const nueva = await servicio.renovar(hogar.id, 'marta@example.com');
  await assert.rejects(servicio.unir('ana@example.com', hogar.invitacion.codigo), { status: 400 });
  assert.equal((await servicio.unir('ana@example.com', nueva.codigo)).id, hogar.id);
});

test('rechaza nombres, identificadores y códigos inválidos y caducados', async () => {
  const { servicio, avanzar } = preparar();
  for (const nombre of ['', '   ', 'x'.repeat(31), {}, null]) {
    await assert.rejects(servicio.crear('marta@example.com', nombre, randomUUID()), { status: 400 });
  }
  await assert.rejects(servicio.crear('marta@example.com', 'Piso', 'incorrecto'), { status: 400 });
  await assert.rejects(servicio.consultar('incorrecto', 'marta@example.com'), { status: 404 });
  for (const codigo of ['', {}, '12345', 'F'.repeat(20)]) {
    await assert.rejects(servicio.unir('alex@example.com', codigo), { status: 400 });
  }
  const hogar = await servicio.crear('marta@example.com', 'Piso', randomUUID());
  avanzar();
  await assert.rejects(servicio.unir('alex@example.com', hogar.invitacion.codigo), { status: 400 });
});

test('un miembro puede abandonar el piso sin dejarlo sin administrador', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', 'Piso', randomUUID());
  await servicio.unir('alex@example.com', hogar.invitacion.codigo);
  await assert.rejects(servicio.abandonar(hogar.id, 'marta@example.com'), { status: 409 });
  await servicio.abandonar(hogar.id, 'alex@example.com');
  await servicio.abandonar(hogar.id, 'alex@example.com');
  assert.deepEqual(await servicio.listar('alex@example.com'), []);
  await assert.rejects(servicio.consultar(hogar.id, 'alex@example.com'), { status: 404 });
  assert.equal((await servicio.consultar(hogar.id, 'marta@example.com')).miembros.length, 1);
});
test('un turno mensual recupera el día 31 después de febrero', async () => {
  let ahora = new Date('2027-01-31T12:00:00Z');
  const repositorio = crearRepositorioHogaresMemoria({
    buscarPorEmail: async () => ({ nombre: 'Marta', estado: 'activo' })
  });
  const servicio = crearServicioHogares(repositorio, () => ahora);
  const email = 'marta@example.com';
  const hogar = await servicio.crear(email, 'Piso', randomUUID());
  await servicio.crearTarea(hogar.id, email, {
    titulo: 'Limpieza', limite: '2027-01-31', frecuencia: 'mensual'
  });
  assert.equal((await servicio.tareas(hogar.id, email)).turnos[0].fecha, '2027-02-28');
  ahora = new Date('2027-03-01T12:00:00Z');
  const { tareas, turnos } = await servicio.tareas(hogar.id, email);
  assert.deepEqual(tareas.map(tarea => tarea.limite), ['2027-01-31', '2027-02-28', '2027-03-31']);
  assert.equal(turnos[0].fecha, '2027-04-30');
});

test('edita los campos de una tarea pendiente y conserva su identidad', async () => {
  const { servicio } = preparar();
  const hogar = await servicio.crear('marta@example.com', 'Prueba editar', randomUUID());
  const miembro = (await servicio.consultar(hogar.id, 'marta@example.com')).miembros[0];
  await servicio.crearTarea(hogar.id, 'marta@example.com', {titulo:'Original',limite:'2026-11-06'});
  const tarea = (await servicio.tareas(hogar.id, 'marta@example.com')).tareas[0];
  await servicio.modificarTareaPendiente(hogar.id, 'marta@example.com', tarea.id, {titulo:'Nueva',limite:'2026-11-07',frecuencia:'semanal',responsable:miembro.id});
  const actual = (await servicio.tareas(hogar.id, 'marta@example.com')).tareas.find(t=>t.id===tarea.id);
  assert.equal(actual.titulo,'Nueva'); assert.equal(actual.limite,'2026-11-07'); assert.equal(actual.frecuencia,'semanal');
  await assert.rejects(servicio.modificarTareaPendiente(hogar.id,'marta@example.com',tarea.id,{titulo:'',frecuencia:'puntual',responsable:miembro.id}),{status:400});
});

test('solo el administrador del piso gestiona normas y los miembros solo las leen', async()=>{
  const {servicio}=preparar();
  const hogar=await servicio.crear('marta@example.com','Normas',randomUUID());
  await servicio.unir('ana@example.com',hogar.invitacion.codigo);
  const norma=randomUUID();
  await servicio.guardarNorma(hogar.id,'marta@example.com',norma,{titulo:'Descanso',texto:'Silencio desde las 23:00.'});
  assert.equal((await servicio.normas(hogar.id,'ana@example.com')).normas[0].titulo,'Descanso');
  await assert.rejects(servicio.guardarNorma(hogar.id,'ana@example.com',norma,{titulo:'Cambio',texto:'No permitido'}),{status:403});
  await assert.rejects(servicio.guardarNorma(hogar.id,'ana@example.com',norma,null),{status:403});
  await assert.rejects(servicio.normas(hogar.id,'ajeno@example.com'),{status:404});
  await assert.rejects(servicio.guardarNorma(hogar.id,'marta@example.com',norma,{titulo:'',texto:'Texto'}),{status:400});
  await servicio.guardarNorma(hogar.id,'marta@example.com',norma,{titulo:'Descanso actualizado',texto:'Silencio desde las 00:00.'});
  assert.equal((await servicio.normas(hogar.id,'ana@example.com')).normas.length,1);
  await servicio.guardarNorma(hogar.id,'marta@example.com',norma,{titulo:'Solo título'});
  assert.equal((await servicio.normas(hogar.id,'ana@example.com')).normas[0].texto,'');
  await servicio.guardarNorma(hogar.id,'marta@example.com',norma,null);
  assert.deepEqual((await servicio.normas(hogar.id,'ana@example.com')).normas,[]);
});

test('avisos: permisos de autor, reintentos y lectura independiente sin perder mensajes nuevos',async()=>{
  const {servicio}=preparar();const hogar=await servicio.crear('marta@example.com','Chat',randomUUID());await servicio.unir('ana@example.com',hogar.invitacion.codigo);
  const primero=randomUUID();await servicio.guardarAviso(hogar.id,'marta@example.com',primero,'Viene el fontanero');await servicio.guardarAviso(hogar.id,'marta@example.com',primero,'Viene el fontanero');
  let ana=await servicio.avisos(hogar.id,'ana@example.com');assert.equal(ana.avisos.length,1);assert.equal(ana.sinLeer,true);assert.equal((await servicio.avisos(hogar.id,'marta@example.com')).sinLeer,false);
  await assert.rejects(servicio.guardarAviso(hogar.id,'ana@example.com',primero,'Cambio',true),{status:403});await assert.rejects(servicio.guardarAviso(hogar.id,'ana@example.com',primero,null),{status:403});await assert.rejects(servicio.avisos(hogar.id,'ajeno@example.com'),{status:404});
  await servicio.guardarAviso(hogar.id,'marta@example.com',randomUUID(),'Otro aviso');await servicio.leerAvisos(hogar.id,'ana@example.com',ana.cursor);ana=await servicio.avisos(hogar.id,'ana@example.com');assert.equal(ana.sinLeer,true);assert.equal(ana.avisos.filter(a=>a.nuevo).length,1);
  await servicio.leerAvisos(hogar.id,'ana@example.com',ana.cursor);assert.equal((await servicio.avisos(hogar.id,'ana@example.com')).sinLeer,false);
  await servicio.guardarAviso(hogar.id,'marta@example.com',primero,'Horario actualizado',true);assert.equal((await servicio.avisos(hogar.id,'ana@example.com')).sinLeer,false);
  await servicio.guardarAviso(hogar.id,'marta@example.com',primero,null);assert.equal((await servicio.avisos(hogar.id,'ana@example.com')).avisos.length,1);
  await assert.rejects(servicio.guardarAviso(hogar.id,'marta@example.com',randomUUID(),'   '),{status:400});
});
