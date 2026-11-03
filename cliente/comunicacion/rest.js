// Capa de comunicación: realiza peticiones a la API.
// No modifica elementos de la interfaz.
async function enviarConfirmacion(ruta, datos) {
  const respuesta = await fetch(ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const resultado = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(resultado.error || 'No se pudo completar la confirmación.');
  }
  return resultado;
}

export function confirmarCuenta(email, token) {
  return enviarConfirmacion('/api/confirmar', { email, token });
}

export function reenviarConfirmacion(email, clave) {
  return enviarConfirmacion('/api/confirmacion/reenviar', { email, clave });
}

export async function consultarGoogle() {
  const respuesta = await fetch('/api/auth/google/config', { cache: 'no-store' });
  if (!respuesta.ok) return { disponible: false };
  return respuesta.json();
}

export async function consultarEstado() {
  const respuesta = await fetch('/api/estado');

  if (!respuesta.ok) {
    throw new Error('No se pudo consultar el estado del servidor.');
  }

  return respuesta.json();
}
// Envía los datos del registro al servidor.
export async function registrarUsuario(email, nombre, clave) {
  const respuesta = await fetch('/api/usuarios', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, nombre, clave })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(resultado.error || 'No se pudo crear la cuenta.');
  }

  return resultado;
}
// Envía las credenciales y recibe el resultado del login.
export async function iniciarSesion(email, clave) {
  const respuesta = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, clave })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(resultado.error || 'No se pudo iniciar sesión.');
  }

  return resultado;
}
// Consulta si hay un usuario con sesión iniciada.
export async function consultarSesion() {
  const respuesta = await fetch('/api/sesion', {
    cache: 'no-store'
  });

  // No tener sesión iniciada es un estado normal.
  if (respuesta.status === 401) {
    return null;
  }

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      resultado.error || 'No se pudo consultar la sesión.'
    );
  }

  return resultado;
}

// Solicita al servidor que invalide la sesión.
export async function cerrarSesion() {
  const respuesta = await fetch('/api/logout', {
    method: 'POST'
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      resultado.error || 'No se pudo cerrar la sesión.'
    );
  }

  return resultado;
}
