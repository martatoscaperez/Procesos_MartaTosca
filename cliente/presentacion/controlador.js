// Capa de presentación: consulta la API mediante rest.js
// y actualiza lo que ve el usuario.
import { mostrarHogares } from './hogares.js';
import {
  registrarUsuario,
  iniciarSesion,
  consultarSesion,
  cerrarSesion,
  reenviarConfirmacion,
  consultarGoogle
} from '../comunicacion/rest.js';

// Localizamos los elementos de la página.
const botonLogin = document.getElementById('mostrar-login');
const botonRegistro = document.getElementById('mostrar-registro');
const formularioLogin = document.getElementById('formulario-login');
const formularioRegistro = document.getElementById('formulario-registro');
const mensaje = document.getElementById('mensaje');
const avisoLogin = formularioLogin.querySelector('.aviso-login');
const tarjetaAcceso = mensaje.parentElement;
avisoLogin.append(mensaje);
const panelSesion = document.getElementById('panel-sesion');
const usuarioConectado = document.getElementById('usuario-conectado');
const botonCerrarSesion = document.getElementById('cerrar-sesion');
const accesoAnimado = document.getElementById('acceso-animado');
const saludoLogin = document.getElementById('saludo-login');
const saludoRegistro = document.getElementById('saludo-registro');
const botonReenviar = document.getElementById('reenviar-confirmacion');
const accesoGoogle = document.getElementById('acceso-google');
const vinculoGoogle = document.getElementById('vinculo-google');
let googleDisponible = false;
let sesionConectada = false;

function mostrarGoogle() {
  accesoGoogle.hidden = !googleDisponible || sesionConectada;
  vinculoGoogle.hidden = !googleDisponible || !sesionConectada;
}

async function prepararGoogle() {
  try {
    googleDisponible = (await consultarGoogle()).disponible === true;
  } catch {
    googleDisponible = false;
  }
  mostrarGoogle();
}

botonReenviar.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value.trim();
  const clave = document.getElementById('login-clave').value;
  if (!email || !clave) {
    mensaje.textContent = 'Introduce el email y la contraseña de tu cuenta pendiente.';
    return;
  }
  botonReenviar.disabled = true;
  mensaje.textContent = 'Enviando correo…';
  try {
    const resultado = await reenviarConfirmacion(email, clave);
    mensaje.textContent = resultado.mensaje;
  } catch (error) {
    mensaje.textContent = error.message;
  } finally {
    botonReenviar.disabled = false;
  }
});

// Muestra un formulario y oculta el otro.
function cambiarFormulario(mostrarLogin) {
  botonReenviar.hidden = true;
  formularioLogin.hidden = !mostrarLogin;
  formularioRegistro.hidden = mostrarLogin;
  (mostrarLogin ? avisoLogin : tarjetaAcceso).append(mensaje);

  accesoAnimado.classList.toggle('modo-registro', !mostrarLogin);
  saludoLogin.hidden = !mostrarLogin;
  saludoRegistro.hidden = mostrarLogin;

  mensaje.textContent = '';
}

// Actualiza la interfaz según haya sesión o no.
function mostrarSesion(usuario) {
  botonReenviar.hidden = true;
  const conectado = usuario !== null;
  sesionConectada = conectado;
  mostrarGoogle();

  panelSesion.hidden = !conectado;
  accesoAnimado.hidden = conectado;
  if (conectado) tarjetaAcceso.append(mensaje);
  mostrarHogares(usuario);
  formularioLogin.hidden = conectado;
  formularioRegistro.hidden = true;

  usuarioConectado.textContent = conectado
    ? `Hola, ${usuario.nombre}.`
    : '';

  if (!conectado) {
    cambiarFormulario(true);
  }
  const opciones = document.getElementById('opciones-cuenta');
  opciones.hidden = !conectado || location.hash !== '#opciones-cuenta';
  if (!opciones.hidden) {
    opciones.open = true;
    opciones.scrollIntoView({ block: 'nearest' });
    opciones.querySelector('summary').focus({ preventScroll: true });
  }
}

// Recupera la sesión cuando se carga o se recarga la página.
async function recuperarSesion() {
  try {
    const usuario = await consultarSesion();
    mostrarSesion(usuario);
  } catch (error) {
    mensaje.textContent = error.message;
  }
}

// Asociamos cada botón con su acción.
botonLogin.addEventListener('click', () => {
  cambiarFormulario(true);
  formularioLogin.querySelector('h3').focus({ preventScroll: true });
});

botonRegistro.addEventListener('click', () => {
  cambiarFormulario(false);
  formularioRegistro.querySelector('h3').focus({ preventScroll: true });
});

// Envía las credenciales y muestra el resultado del login.
formularioLogin.addEventListener('input', () => {
  botonReenviar.hidden = true;
});

formularioLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const clave = document.getElementById('login-clave').value;

  const botonEnviar = formularioLogin.querySelector(
    'button[type="submit"]'
  );

  botonEnviar.disabled = true;
  botonReenviar.hidden = true;
  mensaje.textContent = 'Iniciando sesión…';

  try {
    const usuario = await iniciarSesion(email, clave);

    formularioLogin.reset();
    mostrarSesion(usuario);
    mensaje.textContent = '';
    usuarioConectado.focus();
  } catch (error) {
    mensaje.textContent = error.message;
    const mismosDatos =
      document.getElementById('login-email').value.trim() === email &&
      document.getElementById('login-clave').value === clave;
    botonReenviar.hidden =
      error.message !== 'La cuenta está pendiente de confirmación.' ||
      !mismosDatos || formularioLogin.hidden;
  } finally {
    botonEnviar.disabled = false;
  }
});

// Cierra la sesión y vuelve al formulario de login.
botonCerrarSesion.addEventListener('click', async () => {
  botonCerrarSesion.disabled = true;
  mensaje.textContent = 'Cerrando sesión…';

  try {
    await cerrarSesion();

    mostrarSesion(null);
    mensaje.textContent = 'Sesión cerrada.';
  } catch (error) {
    mensaje.textContent = error.message;
  } finally {
    botonCerrarSesion.disabled = false;
  }
});

// Comprueba el formulario y solicita el registro mediante rest.js.
formularioRegistro.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const email = document.getElementById('registro-email').value.trim();
  const nombre = document.getElementById('registro-nombre').value.trim();
  const clave = document.getElementById('registro-clave').value;
  const repetir = document.getElementById('registro-repetir').value;

  const botonEnviar = formularioRegistro.querySelector(
    'button[type="submit"]'
  );

  if (nombre === '') {
    mensaje.textContent = 'Escribe tu nombre.';
    return;
  }

  if (clave !== repetir) {
    mensaje.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  // Evitamos envíos repetidos mientras esperamos la respuesta.
  botonEnviar.disabled = true;
  mensaje.textContent = 'Creando cuenta…';

  try {
    const usuario = await registrarUsuario(email, nombre, clave);

    formularioRegistro.reset();

    mensaje.textContent =
      usuario.correoEnviado
        ? `Cuenta creada para ${usuario.nombre}. Revisa tu correo y spam para activarla.`
        : 'Cuenta creada, pero no se pudo enviar el correo. Puedes reenviarlo desde Iniciar sesión con tu email y contraseña.';
  } catch (error) {
    mensaje.textContent = error.message;
  } finally {
    // Reactivamos el botón tanto si funciona como si falla.
    botonEnviar.disabled = false;
  }
});

// Recuperamos la sesión al cargar la página.
prepararGoogle();
recuperarSesion().then(() => {
  const parametros = new URLSearchParams(location.search);
  const resultado = parametros.get('google');
  const mensajesGoogle = {
    error: 'No se pudo completar el acceso con Google. Comprueba el dominio permitido o vuelve a intentarlo.',
    no_disponible: 'El acceso con Google todavía no está disponible.',
    vincular: 'Ya tienes una cuenta. Entra con tu contraseña y pulsa «Vincular Google a mi cuenta».',
    vinculado: 'Google se ha vinculado a tu cuenta. Ya puedes usarlo para iniciar sesión.'
  };
  if (Object.hasOwn(mensajesGoogle, resultado)) {
    mensaje.textContent = mensajesGoogle[resultado];
    history.replaceState(null, '', location.pathname);
  }
});
