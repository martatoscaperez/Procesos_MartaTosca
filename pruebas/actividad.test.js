import test from 'node:test';
import assert from 'node:assert/strict';
import { registrarActividad } from '../servidor/actividad.js';

test('registra un evento JSON con fecha y campos permitidos', (t) => {
  const salidas = [];

  t.mock.method(console, 'log', (texto) => {
    salidas.push(texto);
  });

  const antes = Date.now();

  registrarActividad('usuario_creado', {
    email: 'prueba@example.com',
    rol: 'usuario',
    estado: 'pendiente',
    codigo: 201
  });

  const despues = Date.now();

  assert.equal(salidas.length, 1);

  const entrada = JSON.parse(salidas[0]);
  const fecha = Date.parse(entrada.fecha);

  assert.ok(Number.isFinite(fecha));
  assert.ok(fecha >= antes && fecha <= despues);

  assert.deepEqual(entrada, {
    fecha: entrada.fecha,
    evento: 'usuario_creado',
    email: 'prueba@example.com',
    rol: 'usuario',
    estado: 'pendiente',
    codigo: 201
  });
});

test('excluye contraseñas, hashes, tokens y cookies del log', (t) => {
  const salidas = [];

  t.mock.method(console, 'log', (texto) => {
    salidas.push(texto);
  });

  registrarActividad('login_correcto', {
    email: 'prueba@example.com',
    clave: 'secreto-ficticio',
    claveHash: 'hash-ficticio',
    token: 'token-ficticio',
    cookie: 'cookie-ficticia',
    SESSION_SECRET: 'sesion-ficticia',
    DATABASE_URL: 'conexion-ficticia'
  });

  assert.equal(salidas.length, 1);

  const entrada = JSON.parse(salidas[0]);

  assert.deepEqual(Object.keys(entrada).sort(), [
    'email',
    'evento',
    'fecha'
  ]);

  for (const secreto of [
    'secreto-ficticio',
    'hash-ficticio',
    'token-ficticio',
    'cookie-ficticia',
    'sesion-ficticia',
    'conexion-ficticia'
  ]) {
    assert.equal(salidas[0].includes(secreto), false);
  }
});