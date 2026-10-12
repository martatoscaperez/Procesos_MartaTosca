// Capa de comunicación: realiza peticiones a la API.
// No modifica elementos de la interfaz.
export async function consultarEstado() {
  const respuesta = await fetch('/api/estado');

  if (!respuesta.ok) {
    throw new Error('No se pudo consultar el estado del servidor.');
  }

  return respuesta.json();
}