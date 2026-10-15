import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dominioPermitido,
  crearServicioUsuarios
} from '../servidor/logica.js';

// Configura la variable para una prueba y la restaura al terminar.
function configurarDominios(t, valor) {
  const anterior = process.env.ALLOWED_DOMAINS;
  process.env.ALLOWED_DOMAINS = valor;

  t.after(() => {
    if (anterior === undefined) {
      delete process.env.ALLOWED_DOMAINS;
    } else {
      process.env.ALLOWED_DOMAINS = anterior;
    }
  });
}

test('variante3: permite los dominios configurados sin distinguir mayúsculas', () => {
  const configuracion = 'uclm.es, alu.uclm.es';

  assert.equal(
    dominioPermitido('ana@UCLM.ES', configuracion),
    true
  );

  assert.equal(
    dominioPermitido('ana@alu.uclm.es', configuracion),
    true
  );
});

test('variante3: rechaza dominios ajenos y subdominios no listados', () => {
  const configuracion = 'uclm.es,alu.uclm.es';

  assert.equal(
    dominioPermitido('ana@otro.es', configuracion),
    false
  );

  assert.equal(
    dominioPermitido('ana@sub.uclm.es', configuracion),
    false
  );

  assert.equal(
    dominioPermitido('ana@falsouclm.es', configuracion),
    false
  );
});

test('variante3: rechaza datos ausentes, tipos incorrectos y emails sin arroba', () => {
  for (const email of [
    undefined,
    null,
    123,
    {},
    [],
    'ana.uclm.es'
  ]) {
    assert.throws(
      () => dominioPermitido(email, 'uclm.es'),
      /El email debe ser un texto que contenga @/
    );
  }
});

test('variante3: una configuración vacía no permite ningún dominio', () => {
  assert.equal(
    dominioPermitido('ana@uclm.es', ''),
    false
  );
});

test('variante3: lee la lista desde ALLOWED_DOMAINS', (t) => {
  configurarDominios(t, 'uclm.es,alu.uclm.es');

  assert.equal(dominioPermitido('ana@uclm.es'), true);
  assert.equal(dominioPermitido('ana@otro.es'), false);
});

test('variante3: rechaza el registro antes de acceder a los datos', async (t) => {
  configurarDominios(t, 'uclm.es,alu.uclm.es');

  const servicio = crearServicioUsuarios({
    buscarPorEmail() {
      throw new Error('No debería consultar la base de datos.');
    }
  });

  await assert.rejects(
    () => servicio.agregarUsuario(
      'ana@otro.es',
      'Ana',
      'clave-de-prueba'
    ),
    /El dominio del email no está permitido/
  );
});