// Capa de comunicación: realiza peticiones a la API.
// No modifica elementos de la interfaz.
export async function solicitarHogares(ruta = '', datos) {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), 15000);
  try {
    const respuesta = await fetch(`/api/hogares${ruta}`, {
      signal: controlador.signal,
      method: datos === undefined ? 'GET' : 'POST',
      cache: 'no-store',
      headers: datos === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: datos === undefined ? undefined : JSON.stringify(datos)
    });
    if (!respuesta.headers.get('content-type')?.includes('application/json')) {
      if (respuesta.status === 413) throw new Error('La foto es demasiado grande. Usa una de hasta 600 KB.');
      if (respuesta.status === 404) throw new Error('La función de pisos no está disponible en este servidor. Si estás en local, reinícialo con npm.cmd start.');
      throw new Error('No se pudo contactar con la función de pisos. Recarga la página e inténtalo otra vez.');
    }
    const resultado = await respuesta.json();
    if (!respuesta.ok) throw new Error(resultado.error || 'No se pudo acceder al piso.');
    return resultado;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(datos === undefined
        ? 'La conexión está tardando demasiado. Vuelve a intentarlo.'
        : 'No se pudo confirmar el guardado a tiempo. Comprueba el resultado antes de volver a intentarlo.');
    }
    throw error;
  } finally {
    clearTimeout(temporizador);
  }
}

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
