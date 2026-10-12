import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('la API mantiene la sesión y la invalida al cerrar sesión', async (t) => {
  // Arrancamos un servidor separado con datos de prueba.
  // No leemos .env ni utilizamos las credenciales personales.
  const proceso = spawn(process.execPath, ['servidor/api.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: {
      ...process.env,
      PORT: '0',
      NODE_ENV: 'development',
      SESSION_SECRET: randomBytes(32).toString('hex'),
      CREAR_USUARIO_PRUEBA: 'true',
      USUARIO_PRUEBA_EMAIL: 'sesion@example.com',
      USUARIO_PRUEBA_CLAVE: 'clave-ficticia-de-prueba'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Cerramos el servidor incluso si falla alguna comprobación.
  t.after(async () => {
    if (proceso.exitCode !== null || proceso.signalCode !== null) {
      return;
    }

    await new Promise((resolve) => {
      proceso.once('exit', resolve);
      proceso.kill();
    });
  });

  const baseUrl = await new Promise((resolve, reject) => {
    let salida = '';
    let errores = '';

    const temporizador = setTimeout(() => {
      limpiar();
      reject(new Error('El servidor de pruebas no arrancó a tiempo.'));
    }, 15000);

    function limpiar() {
      clearTimeout(temporizador);
      proceso.stdout.off('data', leerSalida);
      proceso.stderr.off('data', leerErrores);
      proceso.off('error', fallo);
      proceso.off('exit', salidaPrematura);
    }

    function leerSalida(datos) {
      salida += datos.toString();

      const coincidencia = salida.match(
        /Servidor en http:\/\/localhost:(\d+)/
      );

      if (coincidencia) {
        limpiar();
        resolve(`http://localhost:${coincidencia[1]}`);
      }
    }

    function leerErrores(datos) {
      errores += datos.toString();
    }

    function fallo(error) {
      limpiar();
      reject(error);
    }

    function salidaPrematura(codigo) {
      limpiar();
      reject(new Error(
        `El servidor terminó antes de arrancar (${codigo}): ${errores}`
      ));
    }

    proceso.stdout.on('data', leerSalida);
    proceso.stderr.on('data', leerErrores);
    proceso.once('error', fallo);
    proceso.once('exit', salidaPrematura);
  });

  // Una petición sin cookie no tiene sesión.
  const sinSesion = await fetch(`${baseUrl}/api/sesion`);
  assert.equal(sinSesion.status, 401);

  // Las credenciales incorrectas no crean una sesión.
  const incorrecto = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sesion@example.com',
      clave: 'incorrecta'
    })
  });

  assert.equal(incorrecto.status, 401);
  assert.equal(incorrecto.headers.get('set-cookie'), null);

  // Iniciamos sesión con la cuenta activa de prueba.
  const login = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sesion@example.com',
      clave: 'clave-ficticia-de-prueba'
    })
  });

  assert.equal(login.status, 200);

  const usuario = await login.json();

  assert.deepEqual(usuario, {
    email: 'sesion@example.com',
    nombre: 'Usuario de prueba',
    rol: 'usuario',
    estado: 'activo'
  });

  const cookieCompleta = login.headers.get('set-cookie');

  assert.ok(cookieCompleta);
  assert.match(cookieCompleta, /HttpOnly/i);

  // Enviamos solo el nombre y el valor de la cookie.
  const cookie = cookieCompleta.split(';')[0];

  // Dos peticiones distintas simulan consultas tras recargar la página.
  for (let intento = 0; intento < 2; intento++) {
    const sesion = await fetch(`${baseUrl}/api/sesion`, {
      headers: { Cookie: cookie }
    });

    assert.equal(sesion.status, 200);
    assert.deepEqual(await sesion.json(), usuario);
    assert.equal(sesion.headers.get('cache-control'), 'no-store');
  }

  // Cerramos la sesión.
  const logout = await fetch(`${baseUrl}/api/logout`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });

  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), {
    mensaje: 'Sesión cerrada.'
  });

  assert.match(
    logout.headers.get('set-cookie') || '',
    /connect\.sid=;/
  );

  // Incluso reutilizando la cookie anterior, la sesión ya no es válida.
  const despuesDelLogout = await fetch(`${baseUrl}/api/sesion`, {
    headers: { Cookie: cookie }
  });

  assert.equal(despuesDelLogout.status, 401);
});