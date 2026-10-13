// Capa de datos: consulta y guarda usuarios en PostgreSQL.

// Convierte los nombres de columnas al formato de nuestra lógica.
function convertirUsuario(fila) {
  if (!fila) {
    return null;
  }

  const usuario = {
    email: fila.email,
    nombre: fila.nombre,
    claveHash: fila.clave_hash,
    rol: fila.rol,
    estado: fila.estado
  };

  if (fila.confirmacion_hash !== null) {
    usuario.confirmacionHash = fila.confirmacion_hash;
  }

  if (fila.confirmacion_caduca !== null) {
    usuario.confirmacionCaduca = Number(fila.confirmacion_caduca);
  }

  return usuario;
}

// Prepara los valores para las consultas SQL.
function obtenerValores(usuario) {
  return [
    usuario.email,
    usuario.nombre,
    usuario.claveHash,
    usuario.rol,
    usuario.estado,
    usuario.confirmacionHash ?? null,
    usuario.confirmacionCaduca ?? null
  ];
}

// Recibe la conexión para mantener separado el almacenamiento.
export function crearRepositorioUsuariosPostgres(conexion) {
  return {
    // Busca una cuenta y devuelve null si no existe.
    async buscarPorEmail(email) {
      const resultado = await conexion.query(
        'SELECT * FROM usuarios WHERE email = $1',
        [email]
      );

      return convertirUsuario(resultado.rows[0]);
    },

    // Inserta una cuenta nueva sin sobrescribir una existente.
    async insertar(usuario) {
      try {
        const resultado = await conexion.query(
          `INSERT INTO usuarios (
            email,
            nombre,
            clave_hash,
            rol,
            estado,
            confirmacion_hash,
            confirmacion_caduca
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *`,
          obtenerValores(usuario)
        );

        return convertirUsuario(resultado.rows[0]);
      } catch (error) {
        // PostgreSQL rechaza emails duplicados mediante la clave primaria.
        if (error.code === '23505') {
          throw new Error('Ya existe un usuario con ese email.');
        }

        throw error;
      }
    },

    // Guarda una cuenta o actualiza la que ya existe.
    async guardar(usuario) {
      const resultado = await conexion.query(
        `INSERT INTO usuarios (
          email,
          nombre,
          clave_hash,
          rol,
          estado,
          confirmacion_hash,
          confirmacion_caduca
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          clave_hash = EXCLUDED.clave_hash,
          rol = EXCLUDED.rol,
          estado = EXCLUDED.estado,
          confirmacion_hash = EXCLUDED.confirmacion_hash,
          confirmacion_caduca = EXCLUDED.confirmacion_caduca
        RETURNING *`,
        obtenerValores(usuario)
      );

      return convertirUsuario(resultado.rows[0]);
    },

    // Devuelve todas las cuentas.
    async listar() {
      const resultado = await conexion.query(
        'SELECT * FROM usuarios ORDER BY email'
      );

      return resultado.rows.map(convertirUsuario);
    }
  };
}