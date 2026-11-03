import test from 'node:test';
import assert from 'node:assert/strict';
import { crearCorreoConfirmacion } from '../servidor/correo.js';
import { crearServicioConfirmacion } from '../servidor/confirmacion.js';
import { crearServicioUsuarios } from '../servidor/logica.js';
import { crearRepositorioUsuarios } from '../servidor/datos.js';
process.env.ALLOWED_DOMAINS = 'example.com';

function preparar(fallar = false) {
  const repositorio = crearRepositorioUsuarios();
  const usuarios = crearServicioUsuarios(repositorio);
  const mensajes = [];
  const correo = crearCorreoConfirmacion({
    entorno: { NODE_ENV: 'test', APP_URL: 'https://app.example.com' },
    transporte: {
      async sendMail(mensaje) {
        if (fallar) throw new Error('Fallo SMTP con datos privados');
        mensajes.push(mensaje);
        return { rejected: [] };
      }
    }
  });
  const confirmacion = crearServicioConfirmacion(usuarios, correo);
  return { repositorio, usuarios, mensajes, confirmacion };
}

function enlace(mensaje) {
  return new URL(mensaje.text.match(/https:\/\/\S+/)[0]);
}

test('registro, envío, confirmación y login sin exponer el token en la respuesta', async () => {
  const { usuarios, mensajes, confirmacion, repositorio } = preparar();
  const cuenta = await confirmacion.registrar('correo@example.com', 'Marta', 'clave-prueba');
  assert.equal(cuenta.estado, 'pendiente');
  assert.equal(cuenta.correoEnviado, true);
  assert.equal(mensajes.length, 1);
  assert.deepEqual(mensajes[0].to, { address: cuenta.email });
  const url = enlace(mensajes[0]);
  assert.equal(url.origin, 'https://app.example.com');
  assert.equal(url.pathname, '/confirmar.html');
  assert.equal(url.search, '');
  const datos = new URLSearchParams(url.hash.slice(1));
  const token = datos.get('token');
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(cuenta).includes(token), false);
  assert.notEqual((await repositorio.buscarPorEmail(cuenta.email)).confirmacionHash, token);
  await assert.rejects(usuarios.iniciarSesion(cuenta.email, 'clave-prueba'), /pendiente/);
  await usuarios.confirmarUsuario(datos.get('email'), token);
  assert.equal((await usuarios.iniciarSesion(cuenta.email, 'clave-prueba')).estado, 'activo');
  await assert.rejects(usuarios.confirmarUsuario(cuenta.email, token), /no es válido/);
});

test('un fallo SMTP conserva la cuenta pendiente y permite recuperarla con reenvío', async () => {
  const { usuarios, confirmacion, mensajes } = preparar(true);
  const cuenta = await confirmacion.registrar('fallo@example.com', 'Marta', 'clave-prueba');
  assert.equal(cuenta.correoEnviado, false);
  assert.equal(cuenta.estado, 'pendiente');
  const recuperacion = crearServicioConfirmacion(usuarios, {
    async enviarConfirmacion(email, token) { mensajes.push({ email, token }); }
  });
  assert.equal(await recuperacion.reenviar(cuenta.email, 'clave-prueba'), true);
  await usuarios.confirmarUsuario(cuenta.email, mensajes[0].token);
  assert.equal(await usuarios.usuarioActivo(cuenta.email), true);
});

test('reenviar exige contraseña correcta e invalida el enlace anterior', async () => {
  const { usuarios, mensajes, confirmacion } = preparar();
  const cuenta = await confirmacion.registrar('reenviar@example.com', 'Marta', 'clave-prueba');
  const anterior = new URLSearchParams(enlace(mensajes[0]).hash.slice(1)).get('token');
  await assert.rejects(confirmacion.reenviar(cuenta.email, 'incorrecta'), /esos datos/);
  assert.equal(mensajes.length, 1);
  assert.equal(await confirmacion.reenviar(cuenta.email, 'clave-prueba'), true);
  await assert.rejects(usuarios.confirmarUsuario(cuenta.email, anterior), /no es válido/);
  const nuevo = new URLSearchParams(enlace(mensajes[1]).hash.slice(1)).get('token');
  await usuarios.confirmarUsuario(cuenta.email, nuevo);
  await assert.rejects(confirmacion.reenviar(cuenta.email, 'clave-prueba'), /esos datos/);
  await assert.rejects(confirmacion.reenviar('ausente@example.com', 'clave-prueba'), /esos datos/);
});

test('producción exige origen HTTPS y configuración SMTP completa', () => {
  const entorno = { NODE_ENV: 'production', APP_URL: 'https://app.example.com' };
  assert.throws(() => crearCorreoConfirmacion({ entorno }), /SMTP/);
  for (const APP_URL of ['http://app.example.com', 'https://app.example.com/ruta',
    'https://usuario:clave@app.example.com', 'https://app.example.com?token=privado']) {
    assert.throws(() => crearCorreoConfirmacion({ entorno: { ...entorno, APP_URL } }), /APP_URL/);
  }
});

test('un rechazo del destinatario SMTP no se presenta como correo enviado', async () => {
  const correo = crearCorreoConfirmacion({
    entorno: { APP_URL: 'https://app.example.com', NODE_ENV: 'test' },
    transporte: { async sendMail() { return { rejected: ['correo@example.com'] }; } }
  });
  await assert.rejects(correo.enviarConfirmacion('correo@example.com', 'a'.repeat(64)), /rechazó/);
});

test('el registro rechaza listas de destinatarios y saltos de línea en el email', async () => {
  const { confirmacion, mensajes } = preparar();
  for (const email of ['uno,otro@example.com', 'uno@example.com\r\nBcc:otro@example.com']) {
    await assert.rejects(confirmacion.registrar(email, 'Marta', 'clave-prueba'), /formato válido/);
  }
  assert.equal(mensajes.length, 0);
});
