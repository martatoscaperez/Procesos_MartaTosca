import { solicitarHogares } from './comunicacion/rest.js';

const porId = id => document.getElementById(id);
const crear = porId('elegir-crear-piso');
const unirse = porId('elegir-invitacion');
const formularioCrear = porId('formulario-crear-piso');
const nombrePiso = porId('nombre-piso');
const pantallaCrear = porId('pantalla-crear-piso');
const pantallaInvitar = porId('pantalla-invitar-piso');
const enlaceCreado = porId('enlace-piso-creado');
const codigoCreado = porId('codigo-piso-creado');
const mensajeInvitar = porId('mensaje-invitar-piso');
const mudarse = porId('mudarse-al-piso');
const claveInvitacion = 'hogardo-invitacion';
const invitacionEnlace = new URLSearchParams(location.hash.slice(1)).get('invitacion');
let pisoCreado = null;
if (invitacionEnlace && /^[A-F0-9]{20}$/i.test(invitacionEnlace)) {
  sessionStorage.setItem(claveInvitacion, invitacionEnlace);
  history.replaceState(history.state, '', location.pathname + location.search);
}
const fotoPiso = porId('foto-piso');
const vistaFoto = porId('vista-foto-piso');
const mensajeCrear = porId('mensaje-crear-piso');
let urlFoto;
const formularioUnirse = porId('formulario-unirse');
const mensaje = porId('mensaje-hogares');
const selector = porId('selector-hogar');
let sesion = null;
let generacion = 0;
let solicitud = null;
let ocupado = false;
let revisionListado = 0;
const pasosCrear = [...formularioCrear.querySelectorAll('.paso-crear-piso')];
const siguienteCrear = porId('siguiente-crear-piso');
let pasoCrear = 0;
let pisosPropios = [];

function mostrarPasoCrear(paso, enfocar = true) {
  pasoCrear = paso;
  pasosCrear.forEach((seccion, indice) => { seccion.hidden = indice !== paso; });
  siguienteCrear.hidden = paso === 2;
  porId('confirmar-crear-piso').hidden = paso !== 2;
  porId('progreso-crear-piso').textContent = `Paso ${paso + 1} de 3`;
  mensajeCrear.textContent = '';
  if (enfocar) pasosCrear[paso].querySelector('h3').focus({ preventScroll: true });
}

function avanzarCrear() {
  if (ocupado) return;
  if (pasoCrear === 1) {
    const nombre = nombrePiso.value.trim().toLowerCase();
    const repetido = pisosPropios.some(piso => piso.nombre.trim().toLowerCase() === nombre);
    nombrePiso.setCustomValidity(!nombre ? 'Escribe un nombre para tu piso.'
      : repetido ? 'Ya tienes un piso con ese nombre.' : '');
    if (!nombrePiso.reportValidity()) return;
  }
  mostrarPasoCrear(Math.min(2, pasoCrear + 1));
}

siguienteCrear.addEventListener('click', avanzarCrear);
nombrePiso.addEventListener('input', () => nombrePiso.setCustomValidity(''));
formularioCrear.addEventListener('keydown', evento => {
  if (evento.key === 'Enter' && evento.target === nombrePiso) {
    evento.preventDefault();
    avanzarCrear();
  }
});

function mostrarCrearPiso(visible) {
  if (visible) mostrarPasoCrear(0, false);
  pantallaCrear.hidden = !visible;
  porId('bienvenida-pisos').hidden = visible;
}

function cambiarFormulario(tipo) {
  formularioUnirse.hidden = tipo !== 'unirse';
  unirse.setAttribute('aria-expanded', String(tipo === 'unirse'));
}

async function cargarHogares() {
  const version = generacion;
  const revision = ++revisionListado;
  const hogares = await solicitarHogares();
  if (version !== generacion || revision !== revisionListado) return;
  pisosPropios = hogares.filter(hogar => hogar.propio);
  const opcionInicial = new Option('Selecciona un piso', '', true, true);
  opcionInicial.disabled = true;
  selector.replaceChildren(opcionInicial, ...hogares.map(hogar => new Option(hogar.nombre, hogar.id)));
  porId('mis-hogares').hidden = hogares.length === 0;
}

async function ejecutar(accion, aviso = mensaje) {
  if (ocupado || !sesion) return;
  const version = generacion;
  ocupado = true;
  porId('panel-sesion').setAttribute('aria-busy', 'true');
  for (const boton of controles()) boton.disabled = true;
  aviso.textContent = 'Guardando…';
  try {
    await accion(version);
  } catch (error) {
    if (version === generacion) aviso.textContent = error.message;
  } finally {
    if (version === generacion) {
      ocupado = false;
      porId('panel-sesion').removeAttribute('aria-busy');
      for (const boton of controles()) boton.disabled = false;
    }
  }
}

function controles() {
  return [crear, unirse, selector, siguienteCrear,
    mudarse, porId('volver-crear-piso'), formularioCrear.querySelector('[type="submit"]'),
    formularioUnirse.querySelector('button')];
}

export async function mostrarHogares(usuario) {
  sesion = usuario;
  const version = ++generacion;
  ocupado = false;
  solicitud = null;
  cambiarFormulario(null);
  mostrarCrearPiso(false);
  pantallaInvitar.hidden = true;
  pisoCreado = null;
  formularioCrear.reset();
  actualizarVistaFoto();
  formularioUnirse.reset();
  porId('mis-hogares').hidden = true;
  mensaje.textContent = '';
  porId('panel-sesion').removeAttribute('aria-busy');
  for (const boton of controles()) boton.disabled = false;
  if (!usuario) return;
  const codigoPendiente = sessionStorage.getItem(claveInvitacion);
  if (codigoPendiente) {
    cambiarFormulario('unirse');
    porId('codigo-invitacion').value = codigoPendiente;
  }
  try {
    await cargarHogares();
    if (version === generacion && location.hash === '#mis-hogares') {
      porId('mis-hogares').scrollIntoView();
    }
  } catch (error) {
    if (version === generacion) mensaje.textContent = error.message;
  }
}

crear.addEventListener('click', () => {
  cambiarFormulario(null);
  mensajeCrear.textContent = '';
  actualizarContadorNombre();
  mostrarCrearPiso(true);
  porId('titulo-crear-piso').focus({ preventScroll: true });
});

function actualizarContadorNombre() {
  porId('contador-nombre-piso').textContent = `${nombrePiso.value.length}/${nombrePiso.maxLength}`;
}

nombrePiso.addEventListener('input', actualizarContadorNombre);
porId('volver-crear-piso').addEventListener('click', () => {
  if (ocupado) return;
  if (pasoCrear > 0) {
    mostrarPasoCrear(pasoCrear - 1);
    return;
  }
  mostrarCrearPiso(false);
  crear.focus({ preventScroll: true });
});

function actualizarVistaFoto() {
  if (urlFoto) URL.revokeObjectURL(urlFoto);
  vistaFoto.hidden = true;
  vistaFoto.removeAttribute('src');
  const archivo = fotoPiso.files[0];
  if (!archivo) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ||
      archivo.size > 600_000 || !archivo.size) {
    fotoPiso.value = '';
    mensajeCrear.textContent = 'Elige una imagen JPG, PNG o WebP de hasta 600 KB.';
    return;
  }
  urlFoto = URL.createObjectURL(archivo);
  vistaFoto.src = urlFoto;
  vistaFoto.hidden = false;
}

fotoPiso.addEventListener('change', () => {
  mensajeCrear.textContent = '';
  actualizarVistaFoto();
});

function leerFoto(archivo) {
  if (!archivo) return null;
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result);
    lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
    lector.readAsDataURL(archivo);
  });
}
unirse.addEventListener('click', () => {
  cambiarFormulario('unirse');
  porId('codigo-invitacion').focus();
});

formularioCrear.addEventListener('input', () => { solicitud = null; });
formularioCrear.addEventListener('submit', evento => {
  evento.preventDefault();
  if (pasoCrear !== 2) {
    avanzarCrear();
    return;
  }
  ejecutar(async version => {
    solicitud ??= crypto.randomUUID();
    const datos = Object.fromEntries(new FormData(formularioCrear));
    datos.solicitud = solicitud;
    datos.foto = await leerFoto(fotoPiso.files[0]);
    if (version !== generacion) return;
    const hogar = await solicitarHogares('', datos);
    if (version !== generacion) return;
    const invitacion = hogar.invitacion ?? await solicitarHogares(`/${hogar.id}/invitacion`, {});
    if (version !== generacion) return;
    solicitud = null;
    formularioCrear.reset();
    actualizarVistaFoto();
    mostrarCrearPiso(false);
    cambiarFormulario(null);
    pisoCreado = hogar.id;
    porId('piso-creado').textContent = `«${hogar.nombre}» ya está listo.`;
    const enlace = new URL(location.pathname, location.origin);
    enlace.hash = new URLSearchParams({ invitacion: invitacion.codigo }).toString();
    enlaceCreado.value = enlace.href;
    codigoCreado.value = invitacion.codigo;
    mensajeInvitar.textContent = '';
    porId('bienvenida-pisos').hidden = true;
    pantallaInvitar.hidden = false;
    porId('titulo-invitar-piso').focus({ preventScroll: true });
  }, mensajeCrear);
});

async function copiarParaInvitar(campo) {
  try {
    await navigator.clipboard.writeText(campo.value);
    mensajeInvitar.textContent = 'Copiado. Ya puedes compartirlo con tus compañeros.';
  } catch {
    if (campo.type === 'hidden') {
      mensajeInvitar.textContent = `No se pudo copiar automáticamente. Copia este enlace: ${campo.value}`;
      return;
    }
    campo.focus();
    campo.select();
    mensajeInvitar.textContent = 'Copia el texto seleccionado para compartirlo.';
  }
}

async function compartirInvitacion(campo, datos) {
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(datos))) {
    try {
      await navigator.share(datos);
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  await copiarParaInvitar(campo);
}

porId('compartir-enlace-piso').addEventListener('click', () =>
  compartirInvitacion(enlaceCreado, { title: 'Invitación a HogarDu', url: enlaceCreado.value }));
porId('copiar-enlace-piso').addEventListener('click', () => copiarParaInvitar(enlaceCreado));
porId('compartir-codigo-piso').addEventListener('click', () =>
  compartirInvitacion(codigoCreado, { text: `Código de invitación a HogarDu: ${codigoCreado.value}` }));

function direccionPiso(id) {
  return `./piso.html?id=${encodeURIComponent(id)}`;
}

mudarse.addEventListener('click', () => {
  if (pisoCreado) location.assign(direccionPiso(pisoCreado));
});

formularioUnirse.addEventListener('submit', evento => {
  evento.preventDefault();
  ejecutar(async version => {
    const hogar = await solicitarHogares('/unirse', { codigo: porId('codigo-invitacion').value });
    if (version !== generacion) return;
    sessionStorage.removeItem(claveInvitacion);
    formularioUnirse.reset();
    cambiarFormulario(null);
    location.assign(direccionPiso(hogar.id));
  });
});

selector.addEventListener('change', () => {
  if (sesion && selector.value) location.assign(direccionPiso(selector.value));
});

window.addEventListener('pageshow', evento => {
  if (evento.persisted) selector.value = '';
});
