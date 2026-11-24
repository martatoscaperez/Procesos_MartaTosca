// Preparación idempotente del almacenamiento, independiente de las rutas HTTP.
export async function prepararDatos(conexion) {
  await conexion.query('SELECT email FROM usuarios LIMIT 1');
  await conexion.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_perfil TEXT');
}
