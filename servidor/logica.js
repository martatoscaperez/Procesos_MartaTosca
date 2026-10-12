import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
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
// Los hashes y los datos de confirmación se quedan en el servidor.
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
      if (Buffer.byteLength(clave, 'utf8') > 72) {
        throw new Error('La contraseña supera el límite de 72 bytes.');
      }

      if (repositorio.buscarPorEmail(emailNormalizado)) {
        throw new Error('Ya existe un usuario con ese email.');
      }

      // 12 es el factor de trabajo del cálculo del hash.
      const claveHash = await bcrypt.hash(clave, 12);

      // Durante el await podría llegar otro registro del mismo email.
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

    // Genera un código para confirmar una cuenta pendiente.
    generarConfirmacion(email) {
      const emailNormalizado = normalizarEmail(email);
      const usuario = repositorio.buscarPorEmail(emailNormalizado);

      if (!usuario || usuario.estado !== 'pendiente') {
        throw new Error('La cuenta no está pendiente de confirmación.');
      }

      const token = randomBytes(32).toString('hex');

      // Guardamos el hash del código, no el código original.
      usuario.confirmacionHash = createHash('sha256')
        .update(token)
        .digest('hex');

      // El código caduca después de una hora.
      usuario.confirmacionCaduca = Date.now() + 1000 * 60 * 60;

      repositorio.guardar(usuario);

      // La API lo utilizará para construir el enlace del correo.
      return token;
    },

    // Comprueba el código y activa la cuenta.
    confirmarUsuario(email, token) {
      const emailNormalizado = normalizarEmail(email);
      const usuario = repositorio.buscarPorEmail(emailNormalizado);

      if (
        !usuario ||
        usuario.estado !== 'pendiente' ||
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/.test(token) ||
        !usuario.confirmacionHash ||
        !Number.isFinite(usuario.confirmacionCaduca) ||
        usuario.confirmacionCaduca <= Date.now()
      ) {
        throw new Error(
          'El enlace de confirmación no es válido o ha caducado.'
        );
      }

      const tokenHash = createHash('sha256')
        .update(token)
        .digest('hex');

      if (tokenHash !== usuario.confirmacionHash) {
        throw new Error(
          'El enlace de confirmación no es válido o ha caducado.'
        );
      }

      usuario.estado = 'activo';

      // Eliminamos el código para que no pueda reutilizarse.
      delete usuario.confirmacionHash;
      delete usuario.confirmacionCaduca;

      const guardado = repositorio.guardar(usuario);
      return obtenerDatosPublicos(guardado);
    },

    // Comprueba las credenciales y el estado de la cuenta.
    // La creación de la sesión corresponde a la capa API.
    async iniciarSesion(email, clave) {
      const emailNormalizado = normalizarEmail(email);

      if (typeof clave !== 'string' || clave.length === 0) {
        throw new Error('La contraseña es obligatoria.');
      }

      // Evitamos que bcrypt ignore parte de una contraseña demasiado larga.
      if (Buffer.byteLength(clave, 'utf8') > 72) {
        throw new Error('Email o contraseña incorrectos.');
      }

      const usuario = repositorio.buscarPorEmail(emailNormalizado);

      if (!usuario || usuario.estado === 'eliminado') {
        throw new Error('Email o contraseña incorrectos.');
      }

      const claveCorrecta = await bcrypt.compare(clave, usuario.claveHash);

      if (!claveCorrecta) {
        throw new Error('Email o contraseña incorrectos.');
      }

      // Consultamos otra vez: el estado puede cambiar durante el await.
      const usuarioActual = repositorio.buscarPorEmail(emailNormalizado);

      if (!usuarioActual || usuarioActual.estado === 'eliminado') {
        throw new Error('Email o contraseña incorrectos.');
      }

      if (usuarioActual.estado !== 'activo') {
        throw new Error('La cuenta está pendiente de confirmación.');
      }

      return obtenerDatosPublicos(usuarioActual);
    },

    // Nunca devuelve hashes ni códigos de confirmación al cliente.
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