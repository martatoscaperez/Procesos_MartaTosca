import { solicitarHogares } from '../comunicacion/rest.js';

export function prepararLoteria(id, miembros, actualizar) {
  const porId = nombre => document.getElementById(nombre);
  const formulario = porId('formulario-loteria');
  let solicitud;
  let ocupado = false;
  let titulos = [];
  const nombre = porId('titulo-loteria');
  function pintarBorrador() {
    porId('borrador-loteria').replaceChildren(...titulos.map((titulo, indice) => {
      const fila = document.createElement('li');
      const texto = document.createElement('span');
      texto.textContent = titulo;
      const quitar = document.createElement('button');
      quitar.type = 'button';
      quitar.textContent = '✕';
      quitar.setAttribute('aria-label', `Quitar ${titulo} del sorteo`);
      quitar.addEventListener('click', () => {
        if (ocupado) return;
        titulos.splice(indice, 1);
        solicitud = null;
        pintarBorrador();
      });
      fila.append(texto, quitar);
      return fila;
    }));
  }
  function agregar() {
    if (ocupado) return;
    const titulo = nombre.value.trim();
    if (!titulo || titulos.length >= 200) {
      porId('estado-loteria').textContent = 'Escribe una tarea. Puedes añadir hasta 200.';
      return;
    }
    titulos.push(titulo);
    solicitud = null;
    nombre.value = '';
    porId('estado-loteria').textContent = '';
    pintarBorrador();
    nombre.focus();
  }
  porId('anadir-tarea-loteria').addEventListener('click', agregar);
  nombre.addEventListener('keydown', evento => {
    if (evento.key === 'Enter') { evento.preventDefault(); agregar(); }
  });
  porId('limite-loteria').min = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  porId('miembros-loteria').replaceChildren(...miembros.map(miembro => {
    const etiqueta = document.createElement('label');
    const campo = document.createElement('input');
    campo.type = 'checkbox';
    campo.value = miembro.id;
    campo.checked = true;
    etiqueta.append(campo, miembro.nombre);
    return etiqueta;
  }));
  formulario.addEventListener('input', () => { solicitud = null; });
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (ocupado) return;
    if (nombre.value.trim()) {
      estadoPendiente();
      return;
    }
    const participantes = [...porId('miembros-loteria').querySelectorAll('input:checked')].map(campo => campo.value);
    const estado = porId('estado-loteria');
    if (!titulos.length || !participantes.length) {
      estado.textContent = 'Añade tareas y selecciona al menos un compañero.';
      return;
    }
    solicitud ??= crypto.randomUUID();
    ocupado = true;
    estado.textContent = 'Repartiendo y guardando las tareas…';
    for (const campo of formulario.querySelectorAll('input, textarea, button')) campo.disabled = true;
    try {
      const resultado = await solicitarHogares(`/${id}/tareas/sortear`, {
        solicitud, titulos, participantes, limite: porId('limite-loteria').value
      });
      porId('resultado-loteria').replaceChildren();
      porId('reparto-por-persona').replaceChildren(...participantes.map(participante => {
        const miembro = miembros.find(actual => actual.id === participante);
        const tareas = resultado.filter(tarea => tarea.responsable === participante);
        const grupo = document.createElement('section');
        const titulo = document.createElement('h3');
        titulo.textContent = `${miembro.nombre} · ${tareas.length} ${tareas.length === 1 ? 'tarea' : 'tareas'}`;
        grupo.append(titulo);
        const lista = document.createElement('ul');
        for (const tarea of tareas) {
          const fila = document.createElement('li');
          fila.textContent = tarea.titulo;
          lista.append(fila);
        }
        if (!tareas.length) {
          const vacio = document.createElement('p');
          vacio.textContent = 'Sin tareas en este sorteo.';
          grupo.append(vacio);
        } else grupo.append(lista);
        return grupo;
      }));
      porId('resultado-sorteo').showModal();
      porId('titulo-resultado-sorteo').focus();
      estado.textContent = 'Tareas asignadas. Ya puedes consultarlas en Ver Tareas.';
      titulos = [];
      pintarBorrador();
      solicitud = null;
      actualizar();
    } catch (error) {
      estado.textContent = error.message;
    } finally {
      ocupado = false;
      for (const campo of formulario.querySelectorAll('input, textarea, button')) campo.disabled = false;
    }
  });
  function estadoPendiente() {
    porId('estado-loteria').textContent = 'Pulsa «Añadir tarea» para incluir la tarea que estás escribiendo antes de sortear.';
    nombre.focus();
  }
}
