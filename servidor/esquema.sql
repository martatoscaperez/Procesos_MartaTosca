CREATE TABLE IF NOT EXISTS usuarios (
  email TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'usuario'
    CHECK (rol IN ('usuario', 'administrador')),
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'activo', 'eliminado')),
  confirmacion_hash TEXT,
  confirmacion_caduca BIGINT
);