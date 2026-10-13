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
function obtenerDatosPublicos(usuario) {
  return {
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    estado: usuario.estado
  };
}

// Aplica las mismas reglas con cualquier repositorio compatible.
export function crearServicioUsuarios(
  repositorio = crearRepositorioUsuarios()
) {
  return {
    async agregarUsuario(email, nombre, clave) {
      const emailNormalizado = normalizarEmail(email);

      if (typeof nombre !== 'string' || nombre.trim() === '') {
        throw new Error('El nombre es obligatorio.');
      }

      if (typeof clave !== 'string' || clave.length === 0) {
        throw new Error('La contraseña es obligatoria.');
      }

      if (Buffer.byteLength(clave, 'utf8') > 72) {
        throw new Error('La contraseña supera el límite de 72 bytes.');
      }

      if (await repositorio.buscarPorEmail(emailNormalizado)) {
        throw new Error('Ya existe un usuario con ese email.');
      }

      const claveHash = await bcrypt.hash(clave, 12);

      const usuario = {
        email: emailNormalizado,
        nombre: nombre.trim(),
        claveHash,
        rol: 'usuario',
        estado: 'pendiente'
      };

      // La inserción también rechaza duplicados si llegan
      // dos registros del mismo email simultáneamente.
      const guardado = await repositorio.insertar(usuario);
      return obtenerDatosPublicos(guardado);
    },

    // Genera un código para confirmar una cuenta pendiente.
    async generarConfirmacion(email) {
      const emailNormalizado = normalizarEmail(email);
      const usuario = await repositorio.buscarPorEmail(emailNormalizado);

      if (!usuario || usuario.estado !== 'pendiente') {
        throw new Error('La cuenta no está pendiente de confirmación.');
      }

      const token = randomBytes(32).toString('hex');

      usuario.confirmacionHash = createHash('sha256')
        .update(token)
        .digest('hex');

      usuario.confirmacionCaduca = Date.now() + 1000 * 60 * 60;

      await repositorio.guardar(usuario);

      return token;
    },

    // Comprueba el código y activa la cuenta.
    async confirmarUsuario(email, token) {
      const emailNormalizado = normalizarEmail(email);
      const usuario = await repositorio.buscarPorEmail(emailNormalizado);

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

      delete usuario.confirmacionHash;
      delete usuario.confirmacionCaduca;

      const guardado = await repositorio.guardar(usuario);
      return obtenerDatosPublicos(guardado);
    },

    // La creación de la sesión corresponde a la capa API.
    async iniciarSesion(email, clave) {
      const emailNormalizado = normalizarEmail(email);

      if (typeof clave !== 'string' || clave.length === 0) {
        throw new Error('La contraseña es obligatoria.');
      }

      if (Buffer.byteLength(clave, 'utf8') > 72) {
        throw new Error('Email o contraseña incorrectos.');
      }

      const usuario = await repositorio.buscarPorEmail(emailNormalizado);

      if (!usuario || usuario.estado === 'eliminado') {
        throw new Error('Email o contraseña incorrectos.');
      }

      const claveCorrecta = await bcrypt.compare(clave, usuario.claveHash);

      if (!claveCorrecta) {
        throw new Error('Email o contraseña incorrectos.');
      }

      // El estado puede cambiar mientras comprobamos la contraseña.
      const usuarioActual = await repositorio.buscarPorEmail(
        emailNormalizado
      );

      if (!usuarioActual || usuarioActual.estado === 'eliminado') {
        throw new Error('Email o contraseña incorrectos.');
      }

      if (usuarioActual.estado !== 'activo') {
        throw new Error('La cuenta está pendiente de confirmación.');
      }

      return obtenerDatosPublicos(usuarioActual);
    },

    // Devuelve los datos públicos de una cuenta activa.
    async obtenerUsuarioActivo(email) {
      const usuario = await repositorio.buscarPorEmail(
        normalizarEmail(email)
      );

      if (!usuario || usuario.estado !== 'activo') {
        throw new Error('La cuenta no está activa.');
      }

      return obtenerDatosPublicos(usuario);
    },

    // Nunca devuelve hashes ni códigos de confirmación al cliente.
    async obtenerUsuarios() {
      const usuarios = await repositorio.listar();
      return usuarios.map(obtenerDatosPublicos);
    },

    async usuarioActivo(email) {
      const usuario = await repositorio.buscarPorEmail(
        normalizarEmail(email)
      );

      return usuario !== null && usuario.estado === 'activo';
    },

    async eliminarUsuario(email) {
      const usuario = await repositorio.buscarPorEmail(
        normalizarEmail(email)
      );

      if (!usuario) {
        throw new Error('El usuario no existe.');
      }

      if (usuario.estado === 'eliminado') {
        throw new Error('El usuario ya está eliminado.');
      }

      usuario.estado = 'eliminado';

      const guardado = await repositorio.guardar(usuario);
      return obtenerDatosPublicos(guardado);
    }
  };
}