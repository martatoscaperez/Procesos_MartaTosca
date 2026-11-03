import { confirmarCuenta } from './comunicacion/rest.js';

const parametros = new URLSearchParams(location.hash.slice(1));
const email = parametros.get('email');
const token = parametros.get('token');
// Retira los datos del enlace de la barra y del historial antes de continuar.
history.replaceState(null, '', location.pathname);
const boton = document.getElementById('confirmar-cuenta');
const resultado = document.getElementById('resultado-confirmacion');
if (!email || !/^[a-f0-9]{64}$/.test(token ?? '')) {
  boton.hidden = true;
  resultado.textContent = 'El enlace no es válido. Solicita otro desde el inicio de sesión.';
}
boton.addEventListener('click', async () => {
  boton.disabled = true;
  resultado.textContent = 'Confirmando cuenta…';
  try {
    const respuesta = await confirmarCuenta(email, token);
    resultado.textContent = respuesta.mensaje;
    boton.hidden = true;
  } catch (error) {
    resultado.textContent = error.message;
    boton.disabled = false;
  }
});
