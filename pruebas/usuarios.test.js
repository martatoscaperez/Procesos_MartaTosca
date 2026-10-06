// Usamos el framework de pruebas incluido en Node.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearServicioUsuarios } from '../servidor/logica.js';

test('una cuenta nueva tiene rol usuario y estado pendiente', () => {
  const servicio = crearServicioUsuarios();

  const usuario = servicio.agregarUsuario('marta@example.com');

  assert.deepEqual(usuario, {
    email: 'marta@example.com',
    rol: 'usuario',
    estado: 'pendiente'
  });
});

test('rechaza un email duplicado aunque cambien mayúsculas y espacios', () => {
  const servicio = crearServicioUsuarios();
  servicio.agregarUsuario('marta@example.com');

  assert.throws(
    () => servicio.agregarUsuario(' MARTA@example.com '),
    /Ya existe un usuario con ese email/
  );
});

test('rechaza un alta sin email', () => {
  const servicio = crearServicioUsuarios();

  assert.throws(
    () => servicio.agregarUsuario('   '),
    /El email es obligatorio/
  );
});

test('el listado incluye las cuentas creadas', () => {
  const servicio = crearServicioUsuarios();
  servicio.agregarUsuario('marta@example.com');
  servicio.agregarUsuario('ana@example.com');

  assert.deepEqual(
    servicio.obtenerUsuarios().map(usuario => usuario.email),
    ['marta@example.com', 'ana@example.com']
  );
});

test('una cuenta pendiente no está activa', () => {
  const servicio = crearServicioUsuarios();
  servicio.agregarUsuario('marta@example.com');

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('eliminar una cuenta cambia su estado y deja de estar activa', () => {
  const servicio = crearServicioUsuarios();
  servicio.agregarUsuario('marta@example.com');

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