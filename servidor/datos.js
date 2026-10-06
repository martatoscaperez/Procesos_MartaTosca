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