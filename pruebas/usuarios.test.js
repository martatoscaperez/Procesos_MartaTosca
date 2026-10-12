import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { crearServicioUsuarios } from '../servidor/logica.js';
import { crearRepositorioUsuarios } from '../servidor/datos.js';

test('una cuenta nueva incluye nombre, rol y estado pendiente', async () => {
  const servicio = crearServicioUsuarios();

  const usuario = await servicio.agregarUsuario(
    ' MARTA@example.com ',
    ' Marta ',
    'ejemplo'
  );

  assert.deepEqual(usuario, {
    email: 'marta@example.com',
    nombre: 'Marta',
    rol: 'usuario',
    estado: 'pendiente'
  });
});

test('guarda un hash válido y no expone secretos en sus resultados', async () => {
  // Conservamos el repositorio para inspeccionar los datos internos.
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);
  const clave = 'ejemplo';

  const creado = await servicio.agregarUsuario(
    'marta@example.com',
    'Marta',
    clave
  );

  const interno = repositorio.buscarPorEmail('marta@example.com');

  assert.equal(typeof interno.claveHash, 'string');
  assert.notEqual(interno.claveHash, clave);
  assert.equal(Object.hasOwn(interno, 'clave'), false);

  // El hash corresponde a la contraseña correcta.
  assert.equal(await bcrypt.compare(clave, interno.claveHash), true);

  // Una contraseña diferente no corresponde al hash.
  assert.equal(await bcrypt.compare('otra-clave', interno.claveHash), false);

  const listado = servicio.obtenerUsuarios();
  const eliminado = servicio.eliminarUsuario('marta@example.com');

  // Alta, listado y eliminación devuelven solo datos públicos.
  for (const usuario of [creado, ...listado, eliminado]) {
    assert.deepEqual(Object.keys(usuario).sort(), [
      'email',
      'estado',
      'nombre',
      'rol'
    ]);
  }
});

test('rechaza un email duplicado aunque cambien mayúsculas y espacios', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  await assert.rejects(
    () => servicio.agregarUsuario(' MARTA@example.com ', 'Otra', 'otra'),
    /Ya existe un usuario con ese email/
  );
});

test('rechaza un alta sin email', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.agregarUsuario('   ', 'Marta', 'ejemplo'),
    /El email es obligatorio/
  );
});

test('rechaza un alta sin nombre', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.agregarUsuario('marta@example.com', '   ', 'ejemplo'),
    /El nombre es obligatorio/
  );
});

test('rechaza un alta sin contraseña', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.agregarUsuario('marta@example.com', 'Marta', ''),
    /La contraseña es obligatoria/
  );
});

test('rechaza contraseñas que superan el límite de bcrypt', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.agregarUsuario(
      'marta@example.com',
      'Marta',
      'a'.repeat(73)
    ),
    /La contraseña supera el límite de 72 bytes/
  );
});

test('el listado incluye las cuentas creadas', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');
  await servicio.agregarUsuario('ana@example.com', 'Ana', 'ejemplo');

  assert.deepEqual(
    servicio.obtenerUsuarios().map(usuario => usuario.email),
    ['marta@example.com', 'ana@example.com']
  );
});

test('una cuenta pendiente no está activa', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('eliminar una cuenta cambia su estado y deja de estar activa', async () => {
  const servicio = crearServicioUsuarios();
  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  servicio.eliminarUsuario('marta@example.com');

  assert.equal(servicio.obtenerUsuarios()[0].estado, 'eliminado');
  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('rechaza eliminar una cuenta inexistente', () => {
  const servicio = crearServicioUsuarios();

  assert.throws(
    () => servicio.eliminarUsuario('nadie@example.com'),
    /El usuario no existe/
  );
});