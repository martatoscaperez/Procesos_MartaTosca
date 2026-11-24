import test from 'node:test';
import assert from 'node:assert/strict';
import { moverFechaTurno, planificarTurno, planificarCambioTurno } from '../servidor/logica/turnos.js';

test('las reglas de turnos conservan el día mensual y omiten miembros que ya no están', () => {
  assert.equal(moverFechaTurno('2028-01-31', 31), '2028-02-29');
  assert.equal(moverFechaTurno('2028-02-29', 31), '2028-03-31');
  const activos = new Map([['b', { id: 'b', nombre: 'Bea' }]]);
  const plan = planificarTurno('2026-11-12', 0, ['a', 'b'], null, activos, '2026-11-13');
  assert.equal(plan.tareas.length, 2);
  assert.ok(plan.tareas.every(t => t.miembro.nombre === 'Bea'));
  assert.equal(planificarTurno('2026-11-12', 0, ['a'], null, activos, '2026-11-13').tareas.length, 0);
});

test('editar una recurrencia mantiene el orden desde el responsable y permite convertirla en puntual', () => {
  const plan = planificarCambioTurno(['a', 'b', 'c'], 'b', true, '2026-11-30', 'mensual');
  assert.deepEqual(plan.participantes, ['b', 'c', 'a']);
  assert.equal(plan.siguienteFecha, '2026-12-30');
  const puntual = planificarCambioTurno(['a', 'b'], 'c', false, null, 'puntual');
  assert.equal(puntual.recurrente, false);
  assert.equal(puntual.siguienteFecha, null);
  assert.deepEqual(puntual.participantes, ['c']);
});
