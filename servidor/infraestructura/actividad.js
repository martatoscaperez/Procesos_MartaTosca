// Registra actividad relevante mediante una línea JSON por evento.
export function registrarActividad(evento, datos = {}) {
  const entrada = {
    fecha: new Date().toISOString(),
    evento
  };

  // Solo permitimos estos campos para evitar registrar secretos.
  for (const campo of ['email', 'rol', 'estado', 'codigo']) {
    if (Object.hasOwn(datos, campo)) {
      entrada[campo] = datos[campo];
    }
  }

  console.log(JSON.stringify(entrada));
}