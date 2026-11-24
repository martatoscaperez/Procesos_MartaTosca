// Coordina usuarios y correo sin acoplar la lógica a SMTP ni a Express.
export function crearServicioConfirmacion(usuarios, correo) {
  async function enviar(email) {
    const token = await usuarios.generarConfirmacion(email);
    try {
      await correo.enviarConfirmacion(email, token);
      return true;
    } catch {
      // La cuenta permanece pendiente. Nunca exponemos el error del proveedor.
      return false;
    }
  }

  return {
    async registrar(email, nombre, clave) {
      const usuario = await usuarios.agregarUsuario(email, nombre, clave);
      return { ...usuario, correoEnviado: await enviar(usuario.email) };
    },
    async reenviar(email, clave) {
      const usuario = await usuarios.verificarCuentaPendiente(email, clave);
      return enviar(usuario.email);
    }
  };
}
