import { readFile } from 'node:fs/promises';
import { crearConexion } from '../servidor/conexion.js';

// Conserva las cuentas existentes; permite repetir la migración.
const conexion = crearConexion();
try {
  const sql = await readFile(new URL('../servidor/migracion-google.sql', import.meta.url), 'utf8');
  await conexion.query(sql);
  console.log('Migración Google completada; las cuentas existentes se conservan.');
} finally {
  await conexion.end();
}
