import test from 'node:test';
import assert from 'node:assert/strict';
import { crearRepositorioUsuarios } from '../servidor/datos.js';
import { crearServicioUsuarios } from '../servidor/logica.js';
import { crearServicioIdentidadGoogle } from '../servidor/identidad-google.js';
import { crearOAuthGoogle } from '../servidor/oauth-google.js';

process.env.ALLOWED_DOMAINS = 'example.com,gmail.com';
const perfil = { sub: 'google-123', email: 'marta@example.com', email_verified: true, name: 'Marta' };

function preparar() {
  const repositorio = crearRepositorioUsuarios();
  return {
    repositorio,
    usuarios: crearServicioUsuarios(repositorio),
    google: crearServicioIdentidadGoogle(repositorio)
  };
}

test('Google crea una cuenta activa de usuario sin contraseña local ni datos privados en la respuesta', async () => {
  const { google, usuarios, repositorio } = preparar();
  const creada = await google.acceder(perfil);
  assert.deepEqual(creada, { email: perfil.email, nombre: 'Marta', rol: 'usuario', estado: 'activo' });
  assert.equal((await repositorio.buscarPorEmail(perfil.email)).claveHash, null);
  await assert.rejects(usuarios.iniciarSesion(perfil.email, 'cualquiera'), /incorrectos/);
  assert.deepEqual(await google.acceder(perfil), creada);
  assert.equal((await usuarios.obtenerUsuarios()).length, 1);
});

test('Google mantiene la identidad por sub cuando cambia el email del proveedor', async () => {
  const { google } = preparar();
  await google.acceder(perfil);
  const usuario = await google.acceder({ ...perfil, email: 'otro@example.com' });
  assert.equal(usuario.email, perfil.email);
});

test('Google rechaza emails no verificados, dominios ajenos y perfiles inválidos', async () => {
  const { google, repositorio } = preparar();
  for (const datos of [null, { ...perfil, sub: '' }, { ...perfil, email_verified: false },
    { ...perfil, email_verified: 'true' }, { ...perfil, email: 'marta@ajeno.com' },
    { ...perfil, email: 'uno,otro@example.com' }]) {
    await assert.rejects(google.acceder(datos));
  }
  assert.equal((await repositorio.listar()).length, 0);
});

test('una cuenta local exige vinculación explícita y conserva contraseña y rol', async () => {
  const { google, usuarios, repositorio } = preparar();
  await usuarios.agregarUsuario(perfil.email, 'Marta local', 'clave-local');
  const token = await usuarios.generarConfirmacion(perfil.email);
  await usuarios.confirmarUsuario(perfil.email, token);
  const interno = await repositorio.buscarPorEmail(perfil.email);
  interno.rol = 'administrador';
  await repositorio.guardar(interno);
  await assert.rejects(google.acceder(perfil), { code: 'VINCULAR_GOOGLE' });
  await assert.rejects(google.acceder(perfil, 'otra@example.com'));
  const vinculada = await google.acceder(perfil, perfil.email);
  assert.equal(vinculada.rol, 'administrador');
  assert.equal((await usuarios.iniciarSesion(perfil.email, 'clave-local')).rol, 'administrador');
  assert.deepEqual(await google.acceder(perfil), vinculada);
  await assert.rejects(google.acceder({ ...perfil, sub: 'otro-google' }, perfil.email));
});

test('Google no activa una cuenta local pendiente ni restaura una eliminada', async () => {
  const { google, usuarios } = preparar();
  await usuarios.agregarUsuario(perfil.email, 'Marta', 'clave-local');
  await assert.rejects(google.acceder(perfil, perfil.email), /no está activa/);
  await usuarios.eliminarUsuario(perfil.email);
  await assert.rejects(google.acceder(perfil), /no está activa/);
});

test('una cuenta de Google eliminada no puede volver a entrar ni crear otra por cambiar email', async () => {
  const { google, usuarios } = preparar();
  await google.acceder(perfil);
  await usuarios.eliminarUsuario(perfil.email);
  await assert.rejects(google.acceder({ ...perfil, email: 'otra@example.com' }), /no está activa/);
});

test('Google no vincula un sub que ya pertenece a otra cuenta', async () => {
  const { google } = preparar();
  await google.acceder(perfil);
  await assert.rejects(google.acceder(perfil, 'otra@example.com'), /otra cuenta/);
});

function proveedor() {
  const llamadas = [];
  let nonce;
  const cliente = {
    async generateCodeVerifierAsync() { return { codeVerifier: 'verificador', codeChallenge: 'reto' }; },
    generateAuthUrl(opciones) {
      nonce = opciones.nonce;
      llamadas.push(['url', opciones]);
      return 'https://accounts.google.com/autorizar';
    },
    async getToken(opciones) {
      llamadas.push(['token', opciones]);
      return { tokens: { id_token: 'token-ficticio' } };
    },
    async verifyIdToken(opciones) {
      llamadas.push(['verificar', opciones]);
      return { getPayload: () => ({ ...perfil, nonce }) };
    }
  };
  const entorno = { NODE_ENV: 'production', APP_URL: 'https://app.example.com',
    GOOGLE_CLIENT_ID: 'cliente-ficticio', GOOGLE_CLIENT_SECRET: 'secreto-ficticio' };
  return { oauth: crearOAuthGoogle({ entorno, cliente }), cliente, llamadas, entorno };
}

test('OAuth usa state, nonce, PKCE y valida el ID token para el cliente configurado', async () => {
  const { oauth, llamadas } = proveedor();
  const { intento, url } = await oauth.iniciar();
  assert.match(intento.state, /^[a-f0-9]{64}$/);
  assert.match(intento.nonce, /^[a-f0-9]{64}$/);
  assert.notEqual(intento.state, intento.nonce);
  assert.equal(url, 'https://accounts.google.com/autorizar');
  const opciones = llamadas[0][1];
  assert.deepEqual(opciones.scope, ['openid', 'email', 'profile']);
  assert.equal(opciones.code_challenge_method, 'S256');
  assert.equal(opciones.access_type, 'online');
  assert.equal((await oauth.completar({ code: 'codigo', state: intento.state }, intento)).sub, perfil.sub);
  assert.deepEqual(llamadas[1][1], {
    code: 'codigo', codeVerifier: 'verificador', redirect_uri: 'https://app.example.com/api/auth/google/callback'
  });
  assert.equal(llamadas[2][1].audience, 'cliente-ficticio');
});

test('OAuth rechaza state falso, intento caducado o ausente y cancelación antes de canjear el código', async () => {
  const { oauth, llamadas } = proveedor();
  const { intento } = await oauth.iniciar();
  for (const [query, guardado] of [
    [{ code: 'codigo', state: 'incorrecto' }, intento],
    [{ code: 'codigo', state: intento.state }, { ...intento, caduca: Date.now() - 1 }],
    [{ code: 'codigo', state: intento.state }, undefined],
    [{ code: 'codigo', state: intento.state, error: 'access_denied' }, intento],
    [{ code: ['uno', 'dos'], state: intento.state }, intento]
  ]) await assert.rejects(oauth.completar(query, guardado));
  assert.equal(llamadas.length, 1);
});

test('OAuth rechaza nonce incorrecto, token ausente y firma rechazada por la biblioteca', async () => {
  const { oauth, cliente } = proveedor();
  const { intento } = await oauth.iniciar();
  const query = { code: 'codigo', state: intento.state };
  cliente.verifyIdToken = async () => ({ getPayload: () => ({ ...perfil, nonce: 'ajeno' }) });
  await assert.rejects(oauth.completar(query, intento), /no pertenece/);
  cliente.verifyIdToken = async () => { throw new Error('Firma incorrecta'); };
  await assert.rejects(oauth.completar(query, intento), /Firma incorrecta/);
  cliente.getToken = async () => ({ tokens: {} });
  await assert.rejects(oauth.completar(query, intento), /no devolvió/);
});

test('OAuth exige credenciales y un origen seguro sin rutas ni credenciales', () => {
  const { entorno, cliente } = proveedor();
  assert.throws(() => crearOAuthGoogle({ entorno: {} }));
  for (const APP_URL of ['http://app.example.com', 'https://app.example.com/ruta',
    'https://u:p@app.example.com', 'https://app.example.com?origen=ajeno']) {
    assert.throws(() => crearOAuthGoogle({ entorno: { ...entorno, APP_URL }, cliente }));
  }
});
