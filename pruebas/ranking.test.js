import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarRanking } from '../cliente/ranking.js';

for (const [nombre, puntos, posiciones] of [
  ['sin compañeros', [], []],
  ['una persona', [3], [1]],
  ['dos personas empatadas', [3, 3], [1, 1]],
  ['empate en primer puesto', [3, 3, 0], [1, 1, 2]],
  ['empate en segundo puesto', [3, 1, 1, 0], [1, 2, 2, 3]],
  ['todos empatados', [0, 0, 0, 0], [1, 1, 1, 1]],
  ['varios grupos y puntos negativos', [4, 4, 1, 1, -2, -2, -3], [1, 1, 2, 2, 3, 3, 4]],
  ['sin empates', [4, 1, 0, -1], [1, 2, 3, 4]]
]) {
  test(`ranking: ${nombre}`, () => {
    const miembros = puntos.map((puntos, id) => ({ id: String(id), nombre: `Persona ${id}`, puntos }));
    const resultado = clasificarRanking(miembros);
    assert.deepEqual(resultado.map(m => m.posicion), posiciones);
    assert.deepEqual(resultado.map(m => m.empatado), puntos.map(p => puntos.filter(x => x === p).length > 1));
    assert.ok(miembros.every(m => !Object.hasOwn(m, 'posicion')));
  });
}
test('ranking: orden estable por puntuación, nombre e identidad, sin modificar la entrada', () => {
  const entrada = [
    { id: 'c', nombre: 'Ana', puntos: 1 },
    { id: 'b', nombre: 'Zoe', puntos: 5 },
    { id: 'a', nombre: 'Ana', puntos: 1 }
  ];
  assert.deepEqual(clasificarRanking(entrada).map(m => [m.id, m.posicion]), [['b', 1], ['a', 2], ['c', 2]]);
  assert.deepEqual(entrada.map(m => m.id), ['c', 'b', 'a']);
});
