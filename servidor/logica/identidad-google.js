import { dominioPermitido } from './logica.js';

const datosPublicos = u => ({ email: u.email, nombre: u.nombre, rol: u.rol, estado: u.estado });

// Solo recibe perfiles cuya firma, audiencia y nonce haya validado OAuth.
export function crearServicioIdentidadGoogle(repositorio) {
  return {
    async acceder(perfil, emailVincular) {
      if (!perfil || perfil.email_verified !== true ||
          typeof perfil.sub !== 'string' || !perfil.sub || perfil.sub.length > 255 ||
          typeof perfil.email !== 'string' ||
          !/^[^\s@<>,;:]+@[^\s@<>,;:]+\.[^\s@<>,;:]+$/.test(perfil.email)) {
        throw new Error('Google no ha proporcionado una identidad verificada.');
      }
      const email = perfil.email.trim().toLowerCase();
      if (!dominioPermitido(email)) throw new Error('El dominio del email no está permitido.');

      const vinculada = await repositorio.buscarPorGoogleSub(perfil.sub);
      if (vinculada) {
        if (vinculada.estado !== 'activo') throw new Error('La cuenta no está activa.');
        if (emailVincular && emailVincular !== vinculada.email) {
          throw new Error('La cuenta de Google ya está vinculada a otra cuenta.');
        }
        return datosPublicos(vinculada);
      }

      const existente = await repositorio.buscarPorEmail(email);
      if (existente) {
        if (existente.estado !== 'activo') throw new Error('La cuenta no está activa.');
        // Nunca se vincula automáticamente por coincidencia de email.
        if (emailVincular !== existente.email) {
          const error = new Error('Inicia sesión con contraseña y pulsa Vincular Google.');
          error.code = 'VINCULAR_GOOGLE';
          throw error;
        }
        return datosPublicos(await repositorio.vincularGoogle(email, perfil.sub));
      }

      if (emailVincular) throw new Error('Elige la cuenta de Google con el mismo email.');
      const creada = await repositorio.insertar({
        email,
        nombre: typeof perfil.name === 'string' && perfil.name.trim() ? perfil.name.trim() : email,
        claveHash: null,
        googleSub: perfil.sub,
        rol: 'usuario',
        estado: 'activo'
      });
      return datosPublicos(creada);
    }
  };
}
