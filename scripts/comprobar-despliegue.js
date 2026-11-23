import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Prueba manual contra un hogar de validación: nunca utiliza el piso habitual.
const opciones = Object.fromEntries(process.argv.slice(2).map((v, i, args) =>
  v.startsWith('--') ? [v.slice(2), args[i + 1]] : []).filter(v => v.length));
if (!opciones.url || !opciones.hogar) {
  console.error('Uso: npm run comprobar-despliegue -- --url https://SERVICIO --hogar UUID');
  process.exit(1);
}
const base = new URL(opciones.url).origin;
const ruta = `/api/hogares/${opciones.hogar}`;
const resultados = [];
const sesiones = [];
let aviso;
let lector;
let canal;
function comprobar(nombre, valido) {
  assert.ok(valido, nombre);
  resultados.push(nombre);
  console.log(`OK: ${nombre}`);
}
async function solicitar(camino, cookie, datos) {
  return fetch(base + camino, {
    method: datos === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { Cookie: cookie } : {}),
      ...(datos === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }) },
    body: datos === undefined ? undefined : JSON.stringify(datos),
    signal: AbortSignal.timeout(20000)
  });
}
async function json(camino, cookie, datos) {
  const respuesta = await solicitar(camino, cookie, datos);
  return { estado: respuesta.status, datos: await respuesta.json() };
}
async function entrar(email, clave) {
  assert.ok(email && clave, 'Configura las credenciales de las dos cuentas de prueba en el entorno.');
  const respuesta = await solicitar('/api/login', null, { email, clave });
  assert.equal(respuesta.status, 200, 'La cuenta de prueba no pudo iniciar sesión.');
  const cookie = respuesta.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
  assert.ok(cookie, 'No se recibió la cookie de sesión.');
  sesiones.push(cookie);
  return cookie;
}
try {
  const a = await entrar(process.env.USUARIO_PRUEBA_EMAIL, process.env.USUARIO_PRUEBA_CLAVE);
  const b = await entrar(process.env.ADMIN_EMAIL, process.env.ADMIN_CLAVE);
  comprobar('Dos sesiones independientes', a !== b);
  const ha = await json(ruta, a);
  const hb = await json(ruta, b);
  comprobar('Hogar exclusivo de validación con dos miembros',
    ha.estado === 200 && hb.estado === 200 && ha.datos.nombre === 'Validación Sprint 2' &&
    hb.datos.nombre === ha.datos.nombre && ha.datos.rol === 'administrador' && hb.datos.rol === 'miembro');
  comprobar('Un hogar ajeno no permite acceder',
    (await solicitar('/api/hogares/' + randomUUID(), b)).status === 404);
  comprobar('El miembro no puede escribir normas',
    (await solicitar(ruta + '/normas/' + randomUUID(), b, { titulo: 'No se debe guardar', texto: '' })).status === 403);
  const tareas = await json(ruta + '/tareas', a);
  const propia = tareas.datos.tareas.find(t => t.propia && !t.completada);
  assert.ok(propia, 'Debe existir una tarea pendiente de la primera cuenta.');
  comprobar('No se puede completar la tarea de otra persona',
    (await solicitar(ruta + '/tareas/' + propia.id + '/completar', b, {})).status === 404);
  const ga = await json(ruta + '/gastos', a);
  const gb = await json(ruta + '/gastos', b);
  comprobar('Las dos cuentas consultan los mismos gastos',
    ga.estado === 200 && gb.estado === 200 && JSON.stringify(ga.datos) === JSON.stringify(gb.datos));

  canal = new AbortController();
  const limite = setTimeout(() => canal.abort(), 15000);
  limite.unref();
  try {
    const respuesta = await fetch(base + ruta + '/avisos/en-vivo', { headers: { Cookie: a }, signal: canal.signal });
    comprobar('Canal SSE autenticado', respuesta.status === 200 && respuesta.headers.get('content-type')?.includes('text/event-stream'));
    lector = respuesta.body.getReader();
    let buffer = '';
    const decodificador = new TextDecoder();
    async function esperarCambio() {
      while (true) {
        let fin;
        while ((fin = buffer.indexOf('\n\n')) >= 0) {
          const evento = buffer.slice(0, fin);
          buffer = buffer.slice(fin + 2);
          if (evento.includes('event: cambio')) return;
        }
        const fragmento = await lector.read();
        assert.ok(!fragmento.done, 'El canal terminó antes del cambio.');
        buffer += decodificador.decode(fragmento.value, { stream: true });
      }
    }
    await esperarCambio();
    aviso = randomUUID();
    const texto = 'Prueba automática de cierre: aviso entre dos sesiones independientes.';
    const inicio = Date.now();
    assert.equal((await solicitar(ruta + '/avisos/' + aviso, b, { texto })).status, 200);
    await esperarCambio();
    comprobar('El aviso de la segunda sesión llega por SSE', true);
    console.log(`Tiempo observado de guardado y aviso: ${Date.now() - inicio} ms`);
    assert.equal((await solicitar(ruta + '/avisos/' + aviso, b, { texto })).status, 200);
    const avisosA = await json(ruta + '/avisos', a);
    const avisosB = await json(ruta + '/avisos', b);
    comprobar('Reintentar no duplica el mensaje', avisosA.datos.avisos.filter(v => v.id === aviso).length === 1);
    comprobar('La lectura es individual y los mensajes propios no notifican',
      avisosA.datos.avisos.some(v => v.id === aviso && v.nuevo) &&
      avisosB.datos.avisos.some(v => v.id === aviso && v.propio && !v.nuevo));
    assert.equal((await solicitar(ruta + '/avisos/leidos', a, { cursor: avisosA.datos.cursor })).status, 200);
    comprobar('Al leer desaparece el aviso pendiente', !(await json(ruta + '/avisos', a)).datos.sinLeer);
  } finally {
    clearTimeout(limite);
  }
  console.log(`Despliegue verificado: ${resultados.length} comprobaciones correctas.`);
} catch (error) {
  console.error(`Verificación fallida: ${error.message}`);
  process.exitCode = 1;
} finally {
  canal?.abort();
  await lector?.cancel().catch(() => {});
  if (aviso && sesiones[1]) {
    try {
      const respuesta = await solicitar(ruta + '/avisos/' + aviso + '/eliminar', sesiones[1], {});
      assert.equal(respuesta.status, 200);
    } catch {
      console.error('No se pudo retirar el aviso temporal de prueba.');
      process.exitCode = 1;
    }
  }
  for (const cookie of sesiones) {
    await solicitar('/api/logout', cookie, {}).catch(() => {});
  }
}
