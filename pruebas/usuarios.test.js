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
test('permite iniciar sesión a una cuenta activa con la clave correcta', async () => {
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  // Simulamos una cuenta confirmada únicamente dentro de esta prueba.
  const usuario = repositorio.buscarPorEmail('marta@example.com');
  usuario.estado = 'activo';
  repositorio.guardar(usuario);

  const resultado = await servicio.iniciarSesion(
    ' MARTA@example.com ',
    'ejemplo'
  );

  // El login devuelve datos públicos, sin contraseña ni hash.
  assert.deepEqual(resultado, {
    email: 'marta@example.com',
    nombre: 'Marta',
    rol: 'usuario',
    estado: 'activo'
  });
});

test('rechaza el login de una cuenta pendiente', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  await assert.rejects(
    () => servicio.iniciarSesion('marta@example.com', 'ejemplo'),
    /La cuenta está pendiente de confirmación/
  );
});

test('rechaza una contraseña incorrecta', async () => {
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const usuario = repositorio.buscarPorEmail('marta@example.com');
  usuario.estado = 'activo';
  repositorio.guardar(usuario);

  await assert.rejects(
    () => servicio.iniciarSesion('marta@example.com', 'incorrecta'),
    /Email o contraseña incorrectos/
  );
});

test('rechaza el login de una cuenta inexistente', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.iniciarSesion('nadie@example.com', 'ejemplo'),
    /Email o contraseña incorrectos/
  );
});

test('rechaza el login de una cuenta eliminada', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');
  servicio.eliminarUsuario('marta@example.com');

  await assert.rejects(
    () => servicio.iniciarSesion('marta@example.com', 'ejemplo'),
    /Email o contraseña incorrectos/
  );
});

test('rechaza el login sin contraseña', async () => {
  const servicio = crearServicioUsuarios();

  await assert.rejects(
    () => servicio.iniciarSesion('marta@example.com', ''),
    /La contraseña es obligatoria/
  );
});

test('rechaza una contraseña con contenido adicional tras los 72 bytes', async () => {
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);
  const clave = 'a'.repeat(72);

  await servicio.agregarUsuario('marta@example.com', 'Marta', clave);

  const usuario = repositorio.buscarPorEmail('marta@example.com');
  usuario.estado = 'activo';
  repositorio.guardar(usuario);

  await assert.rejects(
    () => servicio.iniciarSesion('marta@example.com', clave + 'b'),
    /Email o contraseña incorrectos/
  );
});
test('confirmar una cuenta permite iniciar sesión', async () => {
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion(' MARTA@example.com ');
  const interno = repositorio.buscarPorEmail('marta@example.com');

  // Almacenamos un hash, nunca el código original.
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(typeof interno.confirmacionHash, 'string');
  assert.notEqual(interno.confirmacionHash, token);

  const confirmado = servicio.confirmarUsuario(
    ' MARTA@example.com ',
    token
  );

  assert.deepEqual(confirmado, {
    email: 'marta@example.com',
    nombre: 'Marta',
    rol: 'usuario',
    estado: 'activo'
  });

  assert.equal(servicio.usuarioActivo('marta@example.com'), true);

  const actualizado = repositorio.buscarPorEmail('marta@example.com');
  assert.equal(Object.hasOwn(actualizado, 'confirmacionHash'), false);
  assert.equal(Object.hasOwn(actualizado, 'confirmacionCaduca'), false);

  const resultado = await servicio.iniciarSesion(
    'marta@example.com',
    'ejemplo'
  );

  assert.deepEqual(resultado, confirmado);
});

test('rechaza un código incorrecto sin activar la cuenta', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion('marta@example.com');

  // Cambiamos un carácter manteniendo el formato del código.
  const incorrecto =
    (token[0] === 'a' ? 'b' : 'a') + token.slice(1);

  assert.throws(
    () => servicio.confirmarUsuario('marta@example.com', incorrecto),
    /no es válido o ha caducado/
  );

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);

  // El intento incorrecto no invalida el código original.
  servicio.confirmarUsuario('marta@example.com', token);
  assert.equal(servicio.usuarioActivo('marta@example.com'), true);
});

test('rechaza un código caducado', async () => {
  const repositorio = crearRepositorioUsuarios();
  const servicio = crearServicioUsuarios(repositorio);

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion('marta@example.com');

  // Simulamos la caducidad sin esperar una hora.
  const usuario = repositorio.buscarPorEmail('marta@example.com');
  usuario.confirmacionCaduca = Date.now() - 1;
  repositorio.guardar(usuario);

  assert.throws(
    () => servicio.confirmarUsuario('marta@example.com', token),
    /no es válido o ha caducado/
  );

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('un código de confirmación solo puede usarse una vez', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion('marta@example.com');
  servicio.confirmarUsuario('marta@example.com', token);

  assert.throws(
    () => servicio.confirmarUsuario('marta@example.com', token),
    /no es válido o ha caducado/
  );
});

test('generar otro código invalida el anterior', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const anterior = servicio.generarConfirmacion('marta@example.com');
  const nuevo = servicio.generarConfirmacion('marta@example.com');

  assert.notEqual(anterior, nuevo);

  assert.throws(
    () => servicio.confirmarUsuario('marta@example.com', anterior),
    /no es válido o ha caducado/
  );

  servicio.confirmarUsuario('marta@example.com', nuevo);
  assert.equal(servicio.usuarioActivo('marta@example.com'), true);
});

test('rechaza confirmar una cuenta eliminada', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion('marta@example.com');
  servicio.eliminarUsuario('marta@example.com');

  assert.throws(
    () => servicio.confirmarUsuario('marta@example.com', token),
    /no es válido o ha caducado/
  );

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('rechaza códigos con formato incorrecto', async () => {
  const servicio = crearServicioUsuarios();

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');
  servicio.generarConfirmacion('marta@example.com');

  for (const token of [undefined, null, '', 'incorrecto', 123]) {
    assert.throws(
      () => servicio.confirmarUsuario('marta@example.com', token),
      /no es válido o ha caducado/
    );
  }

  assert.equal(servicio.usuarioActivo('marta@example.com'), false);
});

test('rechaza generar un código para una cuenta inexistente o activa', async () => {
  const servicio = crearServicioUsuarios();

  assert.throws(
    () => servicio.generarConfirmacion('nadie@example.com'),
    /La cuenta no está pendiente de confirmación/
  );

  await servicio.agregarUsuario('marta@example.com', 'Marta', 'ejemplo');

  const token = servicio.generarConfirmacion('marta@example.com');
  servicio.confirmarUsuario('marta@example.com', token);

  assert.throws(
    () => servicio.generarConfirmacion('marta@example.com'),
    /La cuenta no está pendiente de confirmación/
  );
});