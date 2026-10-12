// Capa de presentación: consulta la API mediante rest.js
// y actualiza lo que ve el usuario.
import { consultarEstado } from './comunicacion/rest.js';

// Localizamos los elementos de la página.
const indicadorServidor = document.getElementById('estado-servidor');
const botonLogin = document.getElementById('mostrar-login');
const botonRegistro = document.getElementById('mostrar-registro');
const formularioLogin = document.getElementById('formulario-login');
const formularioRegistro = document.getElementById('formulario-registro');
const mensaje = document.getElementById('mensaje');

// Consulta el servidor y muestra si está disponible.
async function mostrarEstadoServidor() {
  try {
    await consultarEstado();
    indicadorServidor.textContent = 'Servidor: ok';
  } catch (error) {
    indicadorServidor.textContent = 'Servidor: no disponible';
    console.error(error);
  }
}

// Muestra un formulario y oculta el otro.
function cambiarFormulario(mostrarLogin) {
  formularioLogin.hidden = !mostrarLogin;
  formularioRegistro.hidden = mostrarLogin;

  botonLogin.setAttribute('aria-pressed', String(mostrarLogin));
  botonRegistro.setAttribute('aria-pressed', String(!mostrarLogin));

  mensaje.textContent = '';
}

// Asociamos cada botón con su acción.
botonLogin.addEventListener('click', () => {
  cambiarFormulario(true);
});

botonRegistro.addEventListener('click', () => {
  cambiarFormulario(false);
});

// Provisional: el inicio de sesión todavía no llama a la API.
formularioLogin.addEventListener('submit', (evento) => {
  evento.preventDefault();
  mensaje.textContent = 'El inicio de sesión todavía no está conectado.';
});

// Comprueba los campos antes de conectar el registro con la API.
formularioRegistro.addEventListener('submit', (evento) => {
  evento.preventDefault();

  const nombre = document.getElementById('registro-nombre').value.trim();
  const clave = document.getElementById('registro-clave').value;
  const repetir = document.getElementById('registro-repetir').value;

  if (nombre === '') {
    mensaje.textContent = 'Escribe tu nombre.';
    return;
  }

  if (clave !== repetir) {
    mensaje.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  mensaje.textContent =
    'Los campos están completos. El registro todavía no está conectado.';
});

// Comprobamos el estado al cargar la página.
mostrarEstadoServidor();