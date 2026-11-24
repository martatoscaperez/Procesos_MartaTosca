import pg from 'pg';

const { Pool } = pg;

// Crea el conjunto de conexiones a PostgreSQL.
export function crearConexion(
  cadenaConexion = process.env.DATABASE_URL
) {
  if (
    typeof cadenaConexion !== 'string' ||
    cadenaConexion.trim() === ''
  ) {
    throw new Error('Falta configurar DATABASE_URL en el entorno.');
  }

  return new Pool({
    connectionString: cadenaConexion,
    connectionTimeoutMillis: 10000,
    max: 5
  });
}