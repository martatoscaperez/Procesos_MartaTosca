// Cada instancia tiene su propia colección de usuarios.
// Esto también permitirá empezar con datos vacíos en cada prueba.
export function crearRepositorioUsuarios() {
  const usuarios = new Map();

  return {
    // Busca un usuario por su email.
    buscarPorEmail(email) {
      const usuario = usuarios.get(email);

      // Devolvemos una copia para evitar cambios desde fuera.
      return usuario ? { ...usuario } : null;
    },
        // Crea una cuenta sin sobrescribir una que ya existe.
    insertar(usuario) {
      if (usuarios.has(usuario.email)) {
        throw new Error('Ya existe un usuario con ese email.');
      }
      if (usuario.googleSub && Array.from(usuarios.values()).some(
        otro => otro.googleSub === usuario.googleSub
      )) throw new Error('La cuenta de Google ya está vinculada.');

      usuarios.set(usuario.email, { ...usuario });
      return { ...usuario };
    },

    buscarPorGoogleSub(sub) {
      const usuario = Array.from(usuarios.values()).find(u => u.googleSub === sub);
      return usuario ? { ...usuario } : null;
    },

    vincularGoogle(email, sub) {
      const usuario = usuarios.get(email);
      if (!usuario || usuario.estado !== 'activo' ||
          (usuario.googleSub && usuario.googleSub !== sub) ||
          Array.from(usuarios.values()).some(u => u.googleSub === sub && u.email !== email)) {
        throw new Error('No se pudo vincular la cuenta de Google.');
      }
      usuario.googleSub = sub;
      return { ...usuario };
    },

    // Guarda un usuario nuevo o actualiza uno existente.
    guardar(usuario) {
      usuarios.set(usuario.email, { ...usuario });
      return { ...usuario };
    },

    // Devuelve una lista con copias de todos los usuarios.
    listar() {
      return Array.from(usuarios.values(), usuario => ({ ...usuario }));
    }
  };
}
export function obtenerEstadoDatos() {
  return { persistenciaConfigurada: false };
}
