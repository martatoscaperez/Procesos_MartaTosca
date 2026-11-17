import { readFile } from 'node:fs/promises';
import { crearConexion } from '../servidor/conexion.js';

const conexion = crearConexion();
let cliente;
try {
  cliente = await conexion.connect();
  await cliente.query('DISCARD TEMP');
  await cliente.query('BEGIN');
  await cliente.query(await readFile(
    new URL('../servidor/migracion-hogares.sql', import.meta.url), 'utf8'
  ));
  await cliente.query('COMMIT');
  console.log('Tablas de hogares e invitaciones preparadas.');
} catch (error) {
  if (cliente) await cliente.query('ROLLBACK');
  console.error('No se pudo preparar la base de datos.', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  cliente?.release();
  await conexion.end();
}
