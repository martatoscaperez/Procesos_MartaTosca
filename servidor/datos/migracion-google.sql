-- Ejecutar una vez sobre la base existente antes de desplegar OAuth.
-- No elimina cuentas ni modifica sus contraseñas, roles o estados.
BEGIN;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_google_sub_unico ON usuarios (google_sub);
ALTER TABLE usuarios ALTER COLUMN clave_hash DROP NOT NULL;
COMMIT;
