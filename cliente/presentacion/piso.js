import { prepararAvisos } from './avisos.js';
import { prepararPerfil } from './perfil.js';
import { prepararCuenta } from './cuenta.js';
import { clasificarRanking } from './ranking.js';
import { prepararNormas } from './normas.js';
import { prepararGastos } from './gastos.js';
import { prepararLoteria } from './loteria.js';
import { consultarSesion, solicitarHogares, cerrarSesion } from '../comunicacion/rest.js';
import { prepararCalendario } from './calendario.js';
import { prepararCompra } from './compra.js';

const porId = id => document.getElementById(id);
for (const vista of ['modificar', 'ver', 'loteria']) {
  porId('vista-' + vista + '-tareas').addEventListener('click', () => {
    for (const nombre of ['modificar', 'ver', 'loteria']) {
      porId('panel-' + nombre + '-tareas').hidden = nombre !== vista;
      porId('vista-' + nombre + '-tareas').setAttribute('aria-pressed', String(nombre === vista));
    }
  });
}
porId('cerrar-sesion-piso').addEventListener('click', async evento => {
  const boton = evento.currentTarget;
  boton.disabled = true;
  try {
    await cerrarSesion();
    location.assign('./');
  } catch (error) {
    porId('error-cuenta-piso').textContent = error.message;
    boton.disabled = false;
  }
});
const enlaces = [...document.querySelectorAll('.navegacion-piso a[href^="#"]')];
const secciones = [...document.querySelectorAll('.seccion-piso')];
const id = new URLSearchParams(location.search).get('id');
const confirmarAbandono = porId('confirmar-abandono');
const aceptarAbandono = porId('aceptar-abandono');
const cancelarAbandono = porId('cancelar-abandono');
const formularioTarea = porId('crear-tarea');
const dialogoCompletar = porId('completar-tarea');
const formularioCompletar = porId('formulario-completar-tarea');
const errorCompletar = porId('error-completar-tarea');
let tareaPorCompletar;

porId('cancelar-completar-tarea').addEventListener('click', () => dialogoCompletar.close());
formularioCompletar.addEventListener('submit', async evento => {
  evento.preventDefault();
  const tarea = tareaPorCompletar;
  const archivo = porId('foto-tarea').files[0];
  const boton = formularioCompletar.querySelector('[type="submit"]');
  boton.disabled = true;
  errorCompletar.textContent = '';
  try {
    if (archivo && (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) ||
        archivo.size < 1 || archivo.size > 600_000)) {
      throw new Error('Elige una foto JPG, PNG o WebP de hasta 600 KB.');
    }
    const foto = archivo ? await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
      lector.readAsDataURL(archivo);
    }) : null;
    await solicitarHogares(`${rutaTareas}/${encodeURIComponent(tarea)}/completar`, { foto });
    if (foto) fotosDesplegadas.add(tarea);
    await cargarTareas();
    if (foto && !listaTareas.find(registro => registro.id === tarea)?.foto) {
      throw new Error('La foto no aparece guardada. Comprueba que el servidor local esté actualizado e inténtalo de nuevo.');
    }
    dialogoCompletar.close();
  } catch (error) {
    errorCompletar.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
});
const estadoTareas = porId('estado-tareas');
const rutaTareas = `/${encodeURIComponent(id)}/tareas`;
let tareasDisponibles = false;
let revisionTareas = 0;
let miembrosPiso = [];
let listaTareas = [];
let verTodas = false;
const frecuencia = porId('frecuencia-tarea');
const ordenTurno = porId('orden-turno');
const participantes = porId('participantes-turno');

function mostrarCamposTarea() {
  const puntual = frecuencia.value === 'puntual';
  ordenTurno.hidden = puntual;
  porId('etiqueta-responsable').hidden = !puntual;
  porId('responsable-tarea').hidden = !puntual;
  porId('responsable-tarea').disabled = !puntual;
}

function actualizarFlechasTurno() {
  for (const fila of participantes.children) {
    fila.querySelector('[data-mover="arriba"]').hidden = !fila.previousElementSibling;
    fila.querySelector('[data-mover="abajo"]').hidden = !fila.nextElementSibling;
  }
}

function prepararParticipantes() {
  for (const miembro of miembrosPiso) {
    const fila = document.createElement('li');
    const etiqueta = document.createElement('label');
    const marcar = document.createElement('input');
    marcar.type = 'checkbox';
    marcar.value = miembro.id;
    marcar.checked = true;
    marcar.defaultChecked = true;
    etiqueta.append(marcar, miembro.propia ? 'Yo' : miembro.nombre);
    fila.append(etiqueta);
    for (const [texto, anterior] of [['↑', true], ['↓', false]]) {
      const mover = document.createElement('button');
      mover.type = 'button';
      mover.textContent = texto;
      mover.dataset.mover = anterior ? 'arriba' : 'abajo';
      mover.setAttribute('aria-label', `${anterior ? 'Subir' : 'Bajar'} a ${miembro.nombre}`);
      mover.addEventListener('click', () => {
        const vecina = anterior ? fila.previousElementSibling : fila.nextElementSibling;
        if (vecina) {
          if (anterior) vecina.before(fila);
          else vecina.after(fila);
          actualizarFlechasTurno();
          (mover.hidden ? fila.querySelector('button:not([hidden])') : mover)?.focus();
        }
      });
      fila.append(mover);
    }
    participantes.append(fila);
  }
  actualizarFlechasTurno();
}

function mostrarTareas() {
  const visibles = verTodas ? listaTareas : listaTareas.filter(tarea => tarea.propia);
  mostrarListaTareas(porId('tareas-pendientes'), visibles.filter(tarea => !tarea.completada));
  mostrarListaTareas(porId('tareas-realizadas'), visibles.filter(tarea => tarea.completada));
}

for (const [idFiltro, todas] of [['mis-tareas', false], ['tareas-del-piso', true]]) {
  porId(idFiltro).addEventListener('click', () => {
    verTodas = todas;
    porId('mis-tareas').setAttribute('aria-pressed', String(!todas));
    porId('tareas-del-piso').setAttribute('aria-pressed', String(todas));
    mostrarTareas();
  });
}
frecuencia.addEventListener('change', mostrarCamposTarea);

function mostrarListaTareas(elemento, tareas) {
  elemento.replaceChildren();
  if (!tareas.length) {
    const vacio = document.createElement('li');
    vacio.textContent = 'No hay tareas en esta lista.';
    elemento.append(vacio);
    return;
  }
  for (const tarea of tareas) {
    const fila = document.createElement('li');
    const titulo = document.createElement('strong');
    titulo.textContent = tarea.titulo;
    const detalle = document.createElement('span');
    const estado = tarea.completada ? (tarea.tarde ? 'Hecha tarde' : 'Hecha a tiempo')
      : (tarea.tarde ? 'Vencida' : 'Pendiente');
    detalle.className = 'datos-fila-tarea';
    const fecha = document.createElement('time');
    if (tarea.limite) fecha.dateTime = tarea.limite;
    fecha.textContent = tarea.limite ? tarea.limite.split('-').reverse().join('/') : 'Sin fecha límite';
    fecha.className = 'fecha-fila-tarea';
    const responsable = document.createElement('span');
    responsable.className = 'responsable-fila-tarea';
    responsable.textContent = tarea.responsable;
    detalle.title = estado;
    detalle.append(fecha, responsable);
    if (tarea.tarde) detalle.append(document.createTextNode(estado));
    fila.classList.add('fila-tarea-editorial');
    fila.append(titulo, detalle);
    if (tarea.completada) {
      fila.classList.add('tarea-hecha');
      const cabecera = document.createElement('div');
      cabecera.className = 'cabecera-tarea-hecha';
      const menu = document.createElement('details');
      menu.className = 'acciones-tarea menu-tarea-hecha';
      const resumen = document.createElement('summary');
      resumen.textContent = '⋯';
      resumen.setAttribute('aria-label', `Opciones de ${tarea.titulo}`);
      const acciones = document.createElement('div');
      const ruta = `${rutaTareas}/${encodeURIComponent(tarea.id)}`;
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.textContent = 'Ocultar';
      const errorOcultar = document.createElement('p');
      errorOcultar.setAttribute('role', 'status');
      errorOcultar.hidden = true;
      eliminar.addEventListener('click', async () => {
        eliminar.disabled = true;
        errorOcultar.hidden = true;
        try {
          const resultado = await solicitarHogares(`${ruta}/ocultar`, {});
          if (resultado.ocultada !== true) throw new Error('El servidor no confirmó que se ocultara la tarea.');
          ++revisionTareas;
          listaTareas = listaTareas.filter(registro => registro.id !== tarea.id);
          mostrarTareas();
        } catch (error) {
          errorOcultar.textContent = error.message;
          errorOcultar.hidden = false;
        } finally {
          eliminar.disabled = false;
        }
      });
      acciones.append(eliminar, errorOcultar);
      menu.append(resumen, acciones);
      titulo.before(cabecera);
      cabecera.append(titulo, menu);
      const puntuacion = document.createElement('span');
      puntuacion.className = 'puntos-tarea-editorial';
      puntuacion.textContent = tarea.puntos > 0 ? '+1 punto' : '−1 punto';
      fila.append(puntuacion);
      mostrarFotoTarea(fila, tarea);
    }
    if (tarea.propia && !tarea.completada) {
      const completar = document.createElement('button');
      completar.type = 'button';
      completar.className = 'cuadro-completar-tarea';
      completar.setAttribute('aria-label', `Marcar como hecha: ${tarea.titulo}`);
      completar.addEventListener('click', () => abrirFotoTarea(tarea));
      const cabecera = document.createElement('div');
      cabecera.className = 'cabecera-tarea-pendiente';
      titulo.before(cabecera);
      cabecera.append(completar, titulo);
    }
    if (!tarea.completada && !tarea.tarde) {
      const menu = document.createElement('details');
      menu.className = 'acciones-tarea menu-tarea-hecha';
      const resumen = document.createElement('summary');
      resumen.textContent = '⋯';
      resumen.setAttribute('aria-label', `Opciones de ${tarea.titulo}`);
      const opciones = document.createElement('div');
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.textContent = 'Editar';
      editar.addEventListener('click', () => { menu.open = false; abrirEdicionTarea(tarea); });
      const eliminar = document.createElement('button');
      eliminar.type = 'button';
      eliminar.textContent = 'Eliminar tarea';
      eliminar.addEventListener('click', async () => {
        eliminar.disabled = true;
        try {
          await solicitarHogares(`${rutaTareas}/${encodeURIComponent(tarea.id)}/eliminar`, {});
          ++revisionTareas;
          listaTareas = listaTareas.filter(actual => actual.id !== tarea.id);
          mostrarTareas();
        } catch (error) {
          estadoTareas.textContent = error.message;
        } finally {
          eliminar.disabled = false;
        }
      });
      opciones.append(editar, eliminar);
      menu.append(resumen, opciones);
      fila.append(menu);
    }
    elemento.append(fila);
  }
}

const fotosDesplegadas = new Set();

function abrirFotoTarea(tarea) {
  tareaPorCompletar = tarea.id;
  formularioCompletar.reset();
  errorCompletar.textContent = '';
  dialogoCompletar.showModal();
}

function mostrarFotoTarea(fila, tarea) {
  if (!tarea.foto) return;
  const detalles = document.createElement('details');
  detalles.className = 'detalle-foto-tarea';
  const resumen = document.createElement('summary');
  resumen.textContent = tarea.foto ? 'Ver foto y comentarios' : 'Ver comentarios';
  resumen.setAttribute('aria-label', `${resumen.textContent} de ${tarea.titulo}`);
  detalles.append(resumen);
  if (tarea.foto) {
    const foto = document.createElement('img');
    foto.className = 'foto-tarea';
    foto.src = tarea.foto;
    foto.alt = `Foto de la tarea ${tarea.titulo}`;
    foto.loading = 'lazy';
    detalles.append(foto);
  } else {
    const aviso = document.createElement('p');
    aviso.textContent = 'Esta tarea se completó sin foto.';
    detalles.append(aviso);
  }
  const comentarios = document.createElement('div');
  for (const { autor, texto } of tarea.comentarios ?? []) {
    const comentario = document.createElement('p');
    comentario.textContent = `${autor}: ${texto}`;
    comentarios.append(comentario);
  }
  const formulario = document.createElement('form');
  const campo = document.createElement('input');
  campo.placeholder = 'Añade un comentario…';
  campo.setAttribute('aria-label', `Comentario sobre la foto de ${tarea.titulo}`);
  campo.maxLength = 500;
  campo.required = true;
  const publicar = document.createElement('button');
  publicar.type = 'submit';
  publicar.textContent = 'Publicar comentario';
  formulario.append(campo, publicar);
  formulario.addEventListener('submit', evento => {
    evento.preventDefault();
    guardarTarea(publicar, `${rutaTareas}/${encodeURIComponent(tarea.id)}/comentarios`, { texto: campo.value });
  });
  detalles.open = fotosDesplegadas.has(tarea.id);
  detalles.addEventListener('toggle', () => {
    if (detalles.open) fotosDesplegadas.add(tarea.id);
    else fotosDesplegadas.delete(tarea.id);
  });
  detalles.append(comentarios, formulario);
  fila.append(detalles);
}

async function cargarTareas() {
  const revision = ++revisionTareas;
  try {
    const { tareas, puntos, hoy, turnos = [], ranking = [], mes } = await solicitarHogares(rutaTareas);
    if (revision !== revisionTareas) return;
    porId('limite-tarea').min = hoy;
    porId('puntos-piso').textContent = `${puntos} ${puntos === 1 ? 'punto' : 'puntos'}`;
    listaTareas = tareas;
    const pendientes = tareas.filter(tarea => tarea.propia && !tarea.completada)
      .sort((a, b) => (a.limite ?? '9999').localeCompare(b.limite ?? '9999'));
    porId('pendientes-inicio').textContent = pendientes.length;
    porId('puntos-inicio').textContent = ranking.find(miembro => miembro.propia)?.puntos ?? 0;
    porId('estado-tareas-inicio').textContent = pendientes.length ? '' : '¡Todo al día! No tienes tareas pendientes.';
    porId('tareas-inicio').replaceChildren(...pendientes.slice(0, 3).map(tarea => {
      const fila = document.createElement('li');
      const completar = document.createElement('button');
      completar.type = 'button';
      completar.className = 'cuadro-completar-tarea';
      completar.setAttribute('aria-label', `Marcar como hecha: ${tarea.titulo}`);
      completar.addEventListener('click', () => abrirFotoTarea(tarea));
      const texto = document.createElement('div');
      const titulo = document.createElement('strong');
      titulo.textContent = tarea.titulo;
      const fecha = document.createElement('small');
      fecha.textContent = `${tarea.limite ? tarea.limite.split('-').reverse().join('/') : 'Sin fecha límite'} · ${tarea.responsable}${tarea.limite && tarea.limite < hoy ? ' · Fuera de plazo' : ''}`;
      texto.append(titulo, fecha);
      fila.append(completar, texto);
      return fila;
    }));
    const primeros = ranking.filter(miembro => miembro.puntos === ranking[0]?.puntos);
    porId('lider-inicio').textContent = primeros.length
      ? `${primeros.map(miembro => miembro.nombre).join(', ')} · ${primeros[0].puntos}${primeros[0].puntos === 1 ? ' punto' : ' puntos'}${primeros.length > 1 ? ' · Empate en cabeza' : ' · En cabeza'}`
      : 'Aún no hay compañeros en el ranking.';
    porId('mes-ranking').textContent = new Date(`${mes}-01T12:00:00`)
      .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const clasificacion = clasificarRanking(ranking);
    const podio = porId('podio-ranking');
    podio.dataset.personas = String(Math.min(clasificacion.length, 3));
    podio.dataset.empatePrimero = String(clasificacion.filter(miembro => miembro.posicion === 1).length > 1);
    podio.replaceChildren(...clasificacion.slice(0, 3).map((miembro, indice) => {
      const fila = document.createElement('li');
      fila.className = 'puesto-podio' + (miembro.propia ? ' puesto-propio' : '');
      fila.dataset.lugar = String(indice + 1);
      fila.dataset.puesto = String(miembro.posicion);
      fila.style.setProperty('--altura-podio', (miembro.posicion === 1 ? 170 : miembro.posicion === 2 ? 125 : 90) + 'px');
      fila.style.setProperty('--retraso-podio', (indice * 110) + 'ms');
      const retrato = document.createElement('div');
      retrato.className = 'retrato-podio';
      const avatar = document.createElement('span');
      avatar.className = 'avatar-podio';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = [...miembro.nombre.trim()][0]?.toUpperCase() || '?';
      retrato.append(avatar);
      if (miembro.posicion === 1) {
        const corona = document.createElement('span');
        corona.className = 'corona-podio';
        corona.textContent = '👑';
        corona.setAttribute('aria-hidden', 'true');
        retrato.append(corona);
      }
      const nombre = document.createElement('strong');
      nombre.className = 'nombre-podio';
      nombre.textContent = miembro.nombre + (miembro.propia ? ' (tú)' : '');
      const puntos = document.createElement('span');
      puntos.className = 'puntos-podio';
      puntos.textContent = miembro.puntos + (miembro.puntos === 1 ? ' punto' : ' puntos');
      if (miembro.empatado) puntos.textContent += ' · Empate';
      const escalon = document.createElement('div');
      escalon.className = 'escalon-podio';
      const medalla = document.createElement('span');
      medalla.textContent = ['🥇', '🥈', '🥉'][miembro.posicion - 1] || '🏅';
      medalla.setAttribute('aria-hidden', 'true');
      const puesto = document.createElement('span');
      puesto.textContent = miembro.posicion + 'º';
      escalon.append(medalla, puesto);
      fila.append(retrato, nombre, puntos, escalon);
      return fila;
    }));
    porId('titulo-resto-ranking').hidden = clasificacion.length <= 3;
    porId('lista-ranking').replaceChildren(...clasificacion.slice(3).map(miembro => {
      const fila = document.createElement('li');
      if (miembro.propia) fila.className = 'ranking-propio';
      fila.textContent = miembro.posicion + 'º · ' + miembro.nombre + (miembro.propia ? ' (tú)' : '') + ' · ' + miembro.puntos + (miembro.puntos === 1 ? ' punto' : ' puntos') + (miembro.empatado ? ' · Empate' : '');
      return fila;
    }));
    porId('estado-ranking').textContent = ranking.length ? '' : 'Todavía no hay compañeros en el ranking.';
    mostrarTareas();
    porId('proximos-turnos').hidden = !turnos.length;
    porId('lista-proximos-turnos').replaceChildren(...turnos.map(turno => {
      const fila = document.createElement('li');
      fila.textContent = turno.responsable
        ? `${turno.titulo} · ${turno.responsable} · ${turno.fecha.split('-').reverse().join('/')}`
        : `${turno.titulo} · Sin participantes activos`;
      return fila;
    }));
  } catch (error) {
    porId('estado-ranking').textContent = error.message;
    porId('estado-tareas-inicio').textContent = error.message;
    if (revision === revisionTareas) estadoTareas.textContent = error.message;
  }
}

async function guardarTarea(boton, ruta, datos, formulario) {
  boton.disabled = true;
  estadoTareas.textContent = '';
  try {
    await solicitarHogares(ruta, datos);
    formulario?.reset();
    mostrarCamposTarea();
    await cargarTareas();
  } catch (error) {
    estadoTareas.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
}

formularioTarea.addEventListener('submit', evento => {
  evento.preventDefault();
  const datos = Object.fromEntries(new FormData(formularioTarea));
  if (datos.frecuencia !== 'puntual') {
    datos.participantes = [...participantes.querySelectorAll('input:checked')].map(campo => campo.value);
  }
  guardarTarea(formularioTarea.querySelector('[type="submit"]'), rutaTareas, datos, formularioTarea);
});

porId('abandonar-piso').addEventListener('click', () => {
  porId('error-abandono').textContent = '';
  confirmarAbandono.showModal();
});
cancelarAbandono.addEventListener('click', () => confirmarAbandono.close());
confirmarAbandono.addEventListener('cancel', evento => {
  if (aceptarAbandono.disabled) evento.preventDefault();
});
aceptarAbandono.addEventListener('click', async () => {
  aceptarAbandono.disabled = true;
  cancelarAbandono.disabled = true;
  try {
    await solicitarHogares(`/${encodeURIComponent(id)}/abandonar`, {});
    location.replace('./');
  } catch (error) {
    porId('error-abandono').textContent = error.message;
  } finally {
    aceptarAbandono.disabled = false;
    cancelarAbandono.disabled = false;
  }
});

function mostrarSeccion() {
  const destino = enlaces.find(enlace => enlace.hash === location.hash) ?? enlaces[0];
  porId('seccion-cabecera').textContent = destino.hash === '#cuenta'
    ? 'Mi cuenta' : destino.textContent.trim();
  for (const enlace of enlaces) {
    if (enlace === destino) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
  for (const seccion of secciones) seccion.hidden = `#${seccion.id}` !== destino.hash;
  if (tareasDisponibles && ['#inicio', '#tareas', '#ranking'].includes(destino.hash)) cargarTareas();
}

window.addEventListener('hashchange', mostrarSeccion);
mostrarSeccion();

try {
  if (!id) throw new Error('Elige un piso desde Mis pisos.');
  const [hogar, usuario] = await Promise.all([
    solicitarHogares(`/${encodeURIComponent(id)}`), consultarSesion()
  ]);
  if (!usuario) throw new Error('Inicia sesión para ver tu piso.');
  const rol = hogar.rol === 'administrador' ? 'Administrador' : 'Miembro';
  porId('nombre-perfil-piso').textContent = usuario.nombre;
  porId('nombre-cuenta-barra').textContent = usuario.nombre;
  porId('avatar-perfil-piso').textContent = [...usuario.nombre.trim()][0]?.toUpperCase() ?? '?';
  porId('avatar-cuenta-tareas').textContent = porId('avatar-perfil-piso').textContent;
  porId('rol-perfil-piso').textContent = rol;
  porId('moneda-configuracion-piso').textContent = `Moneda del piso · ${hogar.moneda}`;
  porId('gestionar-piso').href = `./?piso=${encodeURIComponent(hogar.id)}#mis-hogares`;
  porId('saludo-inicio').textContent = `Vamos a ponernos al día ${usuario.nombre}`;
  porId('fecha-inicio').textContent = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  porId('nombre-piso-cabecera').textContent = hogar.nombre;
  const fotoMenu = porId('foto-piso-menu');
  fotoMenu.hidden = !hogar.foto;
  if (hogar.foto) fotoMenu.src = hogar.foto;
  else fotoMenu.removeAttribute('src');
  prepararPerfil(hogar);
  prepararCuenta(usuario);
  for (const miembro of hogar.miembros) {
    const fila = document.createElement('li');
    const avatar = document.createElement('span');
    avatar.className = 'avatar-miembro';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = [...miembro.nombre.trim()][0]?.toUpperCase() ?? '?';
    if (miembro.foto) {
      const imagen = document.createElement('img'); imagen.alt = ''; imagen.src = miembro.foto;
      avatar.replaceChildren(imagen);
    }
    if (miembro.propia) { fila.dataset.propio = 'true'; fila.dataset.rol = miembro.rol; }
    fila.append(avatar, `${miembro.nombre} · ${miembro.rol === 'administrador' ? 'Administrador' : 'Miembro'}`);
    porId('miembros-hogar').append(fila);
  }
  miembrosPiso = hogar.miembros;
  prepararLoteria(id, hogar.miembros, cargarTareas);
  const selector = porId('responsable-tarea');
  selector.replaceChildren(...hogar.miembros.map(miembro =>
    new Option(miembro.propia ? 'Yo' : miembro.nombre, miembro.id, miembro.propia, miembro.propia)));
  prepararParticipantes();
  mostrarCamposTarea();
  tareasDisponibles = true;
  prepararCalendario(id);
  prepararCompra(id);
  prepararGastos(id, hogar);
  prepararNormas(id, hogar);
  prepararAvisos(id);
  cargarTareas();
  porId('estado-piso').hidden = true;
  porId('panel-piso').hidden = false;
} catch (error) {
  porId('estado-piso').textContent = error.message;
}

const dialogoEditar = porId('editar-tarea');
const formularioEditar = porId('formulario-editar-tarea');
let tareaEditada;
function abrirEdicionTarea(tarea) {
  tareaEditada = tarea.id;
  formularioEditar.elements.titulo.value = tarea.titulo;
  formularioEditar.elements.limite.value = tarea.limite || '';
  formularioEditar.elements.frecuencia.value = tarea.frecuencia || 'puntual';
  const selector = formularioEditar.elements.responsable;
  selector.replaceChildren(...miembrosPiso.map(miembro => {
    const opcion = document.createElement('option'); opcion.value = miembro.id; opcion.textContent = miembro.nombre; return opcion;
  }));
  selector.value = tarea.responsableId;
  porId('error-editar-tarea').textContent = '';
  dialogoEditar.showModal();
}
porId('cancelar-editar-tarea').addEventListener('click', () => dialogoEditar.close());
formularioEditar.addEventListener('submit', async evento => {
  evento.preventDefault();
  const boton = formularioEditar.querySelector('[type="submit"]'); boton.disabled = true;
  try {
    await solicitarHogares(rutaTareas + '/' + tareaEditada + '/modificar', Object.fromEntries(new FormData(formularioEditar)));
    await cargarTareas(); dialogoEditar.close();
  } catch (error) { porId('error-editar-tarea').textContent = error.message; }
  finally { boton.disabled = false; }
});

porId('abrir-gestion-puntuaciones').addEventListener('click', () => porId('dialogo-puntuaciones').showModal());
