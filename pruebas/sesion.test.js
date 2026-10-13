import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

test('la API mantiene la sesión y aplica los permisos de usuarios y administrador', async (t) => {
  // Arrancamos un servidor independiente con datos ficticios en memoria.
  const proceso = spawn(process.execPath, ['servidor/api.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: {
      ...process.env,
      PORT: '0',
      NODE_ENV: 'test',
      SESSION_SECRET: randomBytes(32).toString('hex'),
      CREAR_USUARIO_PRUEBA: 'true',
      USUARIO_PRUEBA_EMAIL: 'sesion@example.com',
      USUARIO_PRUEBA_CLAVE: 'clave-ficticia-de-prueba',
      CREAR_ADMIN_PRUEBA: 'true'
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

  // Las rutas protegidas rechazan peticiones sin sesión.
  for (const [ruta, metodo] of [
    ['/api/usuarios', 'GET'],
    ['/api/usuarios/sesion@example.com/activo', 'GET'],
    ['/api/usuarios/sesion@example.com', 'DELETE']
  ]) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, {
      method: metodo
    });

    assert.equal(respuesta.status, 401);
  }

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

  const cookie = cookieCompleta.split(';')[0];

  // El usuario normal no puede realizar consultas de administrador.
  for (const ruta of [
    '/api/usuarios',
    '/api/usuarios/sesion@example.com/activo'
  ]) {
    const respuesta = await fetch(`${baseUrl}${ruta}`, {
      headers: { Cookie: cookie }
    });

    assert.equal(respuesta.status, 403);
  }

  // Creamos otra cuenta para comprobar que no puede eliminarla.
  const registroOtraCuenta = await fetch(`${baseUrl}/api/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'otra@example.com',
      nombre: 'Otra persona',
      clave: 'otra-clave-ficticia'
    })
  });

  assert.equal(registroOtraCuenta.status, 201);

  const eliminarOtraCuenta = await fetch(
    `${baseUrl}/api/usuarios/otra@example.com`,
    {
      method: 'DELETE',
      headers: { Cookie: cookie }
    }
  );

  assert.equal(eliminarOtraCuenta.status, 403);

  // La cuenta sigue pendiente: no se ha eliminado.
  const loginOtraCuenta = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'otra@example.com',
      clave: 'otra-clave-ficticia'
    })
  });

  assert.equal(loginOtraCuenta.status, 401);
  assert.deepEqual(await loginOtraCuenta.json(), {
    error: 'La cuenta está pendiente de confirmación.'
  });

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

  // La cookie anterior deja de funcionar después del logout.
  const despuesDelLogout = await fetch(`${baseUrl}/api/sesion`, {
    headers: { Cookie: cookie }
  });

  assert.equal(despuesDelLogout.status, 401);

  // Volvemos a entrar para comprobar la eliminación de la propia cuenta.
  const segundoLogin = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sesion@example.com',
      clave: 'clave-ficticia-de-prueba'
    })
  });

  assert.equal(segundoLogin.status, 200);

  const segundaCookieCompleta = segundoLogin.headers.get('set-cookie');
  assert.ok(segundaCookieCompleta);

  const segundaCookie = segundaCookieCompleta.split(';')[0];

  const eliminarPropiaCuenta = await fetch(
    `${baseUrl}/api/usuarios/sesion@example.com`,
    {
      method: 'DELETE',
      headers: { Cookie: segundaCookie }
    }
  );

  assert.equal(eliminarPropiaCuenta.status, 200);
  assert.equal((await eliminarPropiaCuenta.json()).estado, 'eliminado');

  // Una cuenta eliminada pierde el acceso aunque conserve su cookie.
  const sesionEliminada = await fetch(`${baseUrl}/api/sesion`, {
    headers: { Cookie: segundaCookie }
  });

  assert.equal(sesionEliminada.status, 401);

  // Tampoco puede volver a iniciar sesión.
  const loginEliminado = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sesion@example.com',
      clave: 'clave-ficticia-de-prueba'
    })
  });

  assert.equal(loginEliminado.status, 401);

  // El administrador puede iniciar sesión.
  const loginAdmin = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin-prueba@example.com',
      clave: 'clave-ficticia-admin'
    })
  });

  assert.equal(loginAdmin.status, 200);

  const admin = await loginAdmin.json();
  assert.equal(admin.rol, 'administrador');

  const cookieAdminCompleta = loginAdmin.headers.get('set-cookie');
  assert.ok(cookieAdminCompleta);

  const cookieAdmin = cookieAdminCompleta.split(';')[0];

  // El administrador puede listar las cuentas.
  const listadoAdmin = await fetch(`${baseUrl}/api/usuarios`, {
    headers: { Cookie: cookieAdmin }
  });

  assert.equal(listadoAdmin.status, 200);

  const usuarios = await listadoAdmin.json();

  assert.ok(
    usuarios.some(usuario => usuario.email === 'otra@example.com')
  );

  // El listado solo contiene datos públicos.
  for (const cuenta of usuarios) {
    assert.deepEqual(Object.keys(cuenta).sort(), [
      'email',
      'estado',
      'nombre',
      'rol'
    ]);
  }

  // Puede consultar el estado de otra cuenta.
  const estadoOtra = await fetch(
    `${baseUrl}/api/usuarios/otra@example.com/activo`,
    {
      headers: { Cookie: cookieAdmin }
    }
  );

  assert.equal(estadoOtra.status, 200);
  assert.deepEqual(await estadoOtra.json(), { activo: false });

  // Puede consultar una cuenta activa.
  const estadoAdmin = await fetch(
    `${baseUrl}/api/usuarios/admin-prueba@example.com/activo`,
    {
      headers: { Cookie: cookieAdmin }
    }
  );

  assert.equal(estadoAdmin.status, 200);
  assert.deepEqual(await estadoAdmin.json(), { activo: true });

  // Puede eliminar una cuenta ajena.
  const eliminarComoAdmin = await fetch(
    `${baseUrl}/api/usuarios/otra@example.com`,
    {
      method: 'DELETE',
      headers: { Cookie: cookieAdmin }
    }
  );

  assert.equal(eliminarComoAdmin.status, 200);

  const eliminadaPorAdmin = await eliminarComoAdmin.json();
  assert.equal(eliminadaPorAdmin.email, 'otra@example.com');
  assert.equal(eliminadaPorAdmin.estado, 'eliminado');

  // Comprobamos que el cambio quedó guardado.
  const listadoFinal = await fetch(`${baseUrl}/api/usuarios`, {
    headers: { Cookie: cookieAdmin }
  });

  assert.equal(listadoFinal.status, 200);

  const usuariosFinales = await listadoFinal.json();
  const otraCuenta = usuariosFinales.find(
    cuenta => cuenta.email === 'otra@example.com'
  );

  assert.ok(otraCuenta);
  assert.equal(otraCuenta.estado, 'eliminado');
});