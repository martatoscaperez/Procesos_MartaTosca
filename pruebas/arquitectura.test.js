import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
async function archivos(carpeta) {
  const resultado = [];
  for (const entrada of await readdir(path.join(raiz, carpeta), { withFileTypes: true })) {
    const nombre = carpeta + '/' + entrada.name;
    if (entrada.isDirectory()) resultado.push(...await archivos(nombre));
    else if (nombre.endsWith('.js')) resultado.push(nombre);
  }
  return resultado;
}

test('la presentación solo realiza comunicaciones a través de su capa de comunicación', async () => {
  for (const archivo of await archivos('cliente/presentacion')) {
    const codigo = await readFile(path.join(raiz, archivo), 'utf8');
    assert.doesNotMatch(codigo, /\bfetch\s*\(|\bnew\s+(?:EventSource|WebSocket|XMLHttpRequest)\b/, archivo);
    assert.doesNotMatch(codigo, /from\s+['"][^'"]*servidor\//, archivo);
  }
  const comunicacion = await readFile(path.join(raiz, 'cliente/comunicacion/rest.js'), 'utf8');
  assert.doesNotMatch(comunicacion, /\bdocument\.|\bwindow\.|\.textContent\s*=/);
});

test('la lógica no depende de Express, PostgreSQL ni de repositorios concretos', async () => {
  for (const archivo of await archivos('servidor/logica')) {
    const codigo = await readFile(path.join(raiz, archivo), 'utf8');
    assert.doesNotMatch(codigo, /from\s+['"](?:express|pg|[^'"]*\/(?:datos|api|infraestructura)\/)/, archivo);
    assert.doesNotMatch(codigo, /\.\s*(?:query|connect)\s*\(/, archivo);
  }
});

test('los repositorios no importan servicios de negocio ni rutas HTTP', async () => {
  for (const archivo of await archivos('servidor/datos')) {
    const codigo = await readFile(path.join(raiz, archivo), 'utf8');
    assert.doesNotMatch(codigo, /from\s+['"][^'"]*\/(?:logica|api|infraestructura)\//, archivo);
    assert.doesNotMatch(codigo, /from\s+['"]express['"]/, archivo);
  }
});

test('todas las importaciones locales y los scripts de las pantallas existen tras reorganizar las capas', async () => {
  for (const carpeta of ['cliente', 'servidor', 'scripts', 'pruebas']) {
    for (const archivo of await archivos(carpeta)) {
      const codigo = await readFile(path.join(raiz, archivo), 'utf8');
      for (const coincidencia of codigo.matchAll(/(?:from\s+|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)) {
        await assert.doesNotReject(access(path.resolve(raiz, path.dirname(archivo), coincidencia[2])), archivo + ': ' + coincidencia[2]);
      }
    }
  }
  for (const nombre of ['index.html', 'piso.html', 'confirmar.html']) {
    const html = await readFile(path.join(raiz, 'cliente', nombre), 'utf8');
    for (const coincidencia of html.matchAll(/<script[^>]*src=['"](\.\/[^'"]+)['"]/g)) {
      await assert.doesNotReject(access(path.resolve(raiz, 'cliente', coincidencia[1])));
    }
  }
});
