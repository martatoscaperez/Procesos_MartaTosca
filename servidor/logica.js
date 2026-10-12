import bcrypt from 'bcrypt';
import {
  obtenerEstadoDatos,
  crearRepositorioUsuarios
} from './datos.js';

// Consulta el estado del almacenamiento.
export function obtenerEstadoAplicacion() {
  const datos = obtenerEstadoDatos();

  return {
    mensaje: 'Servidor funcionando',
    persistenciaConfigurada: datos.persistenciaConfigurada
  };
}

// Valida y normaliza el email.
function normalizarEmail(email) {
  if (typeof email !== 'string' || email.trim() === '') {
    throw new Error('El email es obligatorio.');
  }

  return email.trim().toLowerCase();
}

// Selecciona los campos que podemos devolver al cliente.
// El hash de la contraseña se queda en el servidor.
function obtenerDatosPublicos(usuario) {
  return {
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado: usuario.estado
  };
}

// Contiene las operaciones y reglas de usuarios.
export function crearServicioUsuarios(
  repositorio = crearRepositorioUsuarios()
) {
  return {
    // El hash se calcula de forma asíncrona.
    async agregarUsuario(email, nombre, clave) {
      const emailNormalizado = normalizarEmail(email);

      if (typeof nombre !== 'string' || nombre.trim() === '') {
        throw new Error('El nombre es obligatorio.');
      }

      if (typeof clave !== 'string' || clave.length === 0) {
        throw new Error('La contraseña es obligatoria.');
      }

      // bcrypt utiliza como máximo 72 bytes de la contraseña.
      // Rechazamos valores mayores para evitar que se recorten.
      if (Buffer.byteLength(clave, 'utf8') > 72) {
        throw new Error('La contraseña supera el límite de 72 bytes.');
      }

      if (repositorio.buscarPorEmail(emailNormalizado)) {
        throw new Error('Ya existe un usuario con ese email.');
      }

      // 12 es el factor de trabajo, no una longitud de contraseña.
      const claveHash = await bcrypt.hash(clave, 12);

      // Comprobamos otra vez porque durante el await puede llegar
      // otra petición de registro con el mismo email.
      if (repositorio.buscarPorEmail(emailNormalizado)) {
        throw new Error('Ya existe un usuario con ese email.');
      }

      const usuario = {
        email: emailNormalizado,
        nombre: nombre.trim(),
        claveHash,
        rol: 'usuario',
        estado: 'pendiente'
      };

      const guardado = repositorio.guardar(usuario);
      return obtenerDatosPublicos(guardado);
    },

    // Nunca devuelve hashes al cliente.
    obtenerUsuarios() {
      return repositorio.listar().map(obtenerDatosPublicos);
    },

    // Una cuenta pendiente, eliminada o inexistente no está activa.
    usuarioActivo(email) {
      const usuario = repositorio.buscarPorEmail(normalizarEmail(email));

      return usuario !== null && usuario.estado === 'activo';
    },

    // Marca la cuenta como eliminada y devuelve sus datos públicos.
    eliminarUsuario(email) {
      const usuario = repositorio.buscarPorEmail(normalizarEmail(email));

      if (!usuario) {
        throw new Error('El usuario no existe.');
      }

      if (usuario.estado === 'eliminado') {
        throw new Error('El usuario ya está eliminado.');
      }

      usuario.estado = 'eliminado';

      const guardado = repositorio.guardar(usuario);
      return obtenerDatosPublicos(guardado);
    }
  };
}