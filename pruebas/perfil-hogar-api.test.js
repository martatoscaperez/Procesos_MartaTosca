import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { crearApiHogares } from '../servidor/api/api-hogares.js';
import { crearServicioHogares } from '../servidor/logica/hogares.js';
import { crearRepositorioHogaresMemoria } from '../servidor/datos/datos-hogares.js';

test('la API permite editar el perfil al administrador y rechaza a miembros y ajenos', async t => {
  const servicio = crearServicioHogares(crearRepositorioHogaresMemoria({
    buscarPorEmail: async email => ({ nombre: email, estado: 'activo' })
  }));
  const hogar = await servicio.crear('admin@example.com', 'Casa', randomUUID());
  await servicio.unir('miembro@example.com', hogar.invitacion.codigo);
  const app = express();
  app.use(express.json());
  // La sesión de prueba identifica al usuario; el permiso lo aplica el servicio real.
  app.use((req, res, next) => { req.usuario = { email: req.get('x-usuario-prueba') }; next(); });
  app.use('/api/hogares', crearApiHogares(servicio));
  app.use((error, req, res, next) => res.status(error.status || 500).json({ error: error.message }));
  const servidor = app.listen(0, '127.0.0.1');
  t.after(() => { servidor.closeAllConnections(); servidor.close(); });
  await new Promise(resolve => servidor.once('listening', resolve));
  const url = `http://127.0.0.1:${servidor.address().port}/api/hogares/${hogar.id}/perfil`;
  const editar = (email, datos) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-usuario-prueba': email }, body: JSON.stringify(datos)
  });
  assert.equal((await editar('miembro@example.com', { nombre: 'Cambio' })).status, 403);
  assert.equal((await editar('ajeno@example.com', { nombre: 'Cambio' })).status, 404);
  assert.equal((await editar('admin@example.com', { nombre: ' ' })).status, 400);
  const respuesta = await editar('admin@example.com', { nombre: 'Nuestro piso', foto: null });
  assert.equal(respuesta.status, 200);
  assert.equal((await respuesta.json()).nombre, 'Nuestro piso');
  assert.equal((await servicio.consultar(hogar.id, 'miembro@example.com')).nombre, 'Nuestro piso');
});
