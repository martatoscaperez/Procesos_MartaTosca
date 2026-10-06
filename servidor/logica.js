// La lógica consulta los datos sin conocer cómo se almacenan.
import {
  obtenerEstadoDatos,
  crearRepositorioUsuarios
} from './datos.js';

// Consulta el almacenamiento y prepara el estado de la aplicación.
export function obtenerEstadoAplicacion() {
  const datos = obtenerEstadoDatos();

  return {
    mensaje: 'Servidor funcionando',
    persistenciaConfigurada: datos.persistenciaConfigurada
  };
}

// Capa de lógica: contiene las operaciones y reglas de usuarios.
// Recibe un repositorio o crea uno nuevo si no se proporciona.
// Las pruebas podrán usar un almacén independiente.
export function crearServicioUsuarios(
  repositorio = crearRepositorioUsuarios()
) {
  return {
    // Crea una cuenta pendiente y evita emails duplicados.
    agregarUsuario(email) {
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error('El email es obligatorio.');
      }

      const emailNormalizado = email.trim().toLowerCase();

      if (repositorio.buscarPorEmail(emailNormalizado)) {
        throw new Error('Ya existe un usuario con ese email.');
      }

      const usuario = {
        email: emailNormalizado,
        rol: 'usuario',
        estado: 'pendiente'
      };

      return repositorio.guardar(usuario);
    },

    // Devuelve todos los usuarios, incluyendo su rol y estado.
    obtenerUsuarios() {
      return repositorio.listar();
    },

    // Comprueba si la cuenta está activa.
    // Las cuentas pendientes, eliminadas o inexistentes devuelven false.
    usuarioActivo(email) {
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error('El email es obligatorio.');
      }

      const emailNormalizado = email.trim().toLowerCase();
      const usuario = repositorio.buscarPorEmail(emailNormalizado);

      return usuario !== null && usuario.estado === 'activo';
    },

    // Conserva la cuenta, pero cambia su estado a eliminado.
    eliminarUsuario(email) {
      if (typeof email !== 'string' || email.trim() === '') {
        throw new Error('El email es obligatorio.');
      }

      const emailNormalizado = email.trim().toLowerCase();
      const usuario = repositorio.buscarPorEmail(emailNormalizado);

      if (!usuario) {
        throw new Error('El usuario no existe.');
      }

      if (usuario.estado === 'eliminado') {
        throw new Error('El usuario ya está eliminado.');
      }

      usuario.estado = 'eliminado';

      return repositorio.guardar(usuario);
    }
  };
}