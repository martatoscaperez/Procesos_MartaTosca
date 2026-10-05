// La lógica consulta los datos sin conocer cómo se almacenan.
import { obtenerEstadoDatos } from './datos.js';

// Capa de lógica: prepara el estado de la aplicación.
// No depende de Express ni de peticiones HTTP.
export function obtenerEstadoAplicacion() {
  const datos = obtenerEstadoDatos();

  return {
    mensaje: 'Servidor funcionando',
    persistenciaConfigurada: datos.persistenciaConfigurada
  };
}