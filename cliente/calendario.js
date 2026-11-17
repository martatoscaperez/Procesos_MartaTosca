import { solicitarHogares } from './comunicacion/rest.js';

export function prepararCalendario(id) {
  const elemento = nombre => document.getElementById(nombre);
  const ruta = `/${encodeURIComponent(id)}/eventos`;
  const dialogo = elemento('dialogo-evento');
  const formulario = elemento('formulario-evento');
  const estado = elemento('estado-calendario');
  const error = elemento('error-evento');
  const todoDia = elemento('evento-todo-dia');
  const hora = elemento('evento-hora');
  let eventos = [];
  let hoy;
  let mes;
  let editando;
  let ocupado = false;
  let revision = 0;

  function fechaTexto(fecha) {
    return fecha.toLocaleDateString('sv-SE');
  }

  function abrir(evento = null, fecha = hoy) {
    if (ocupado) return;
    editando = evento;
    formulario.reset();
    error.textContent = '';
    const propia = !evento || evento.propia;
    elemento('titulo-dialogo-evento').textContent = evento ? 'Detalles del evento' : 'Añadir evento';
    elemento('autor-evento').textContent = evento ? `Añadido por ${evento.autor}` : '';
    elemento('evento-titulo').value = evento?.titulo ?? '';
    elemento('evento-fecha').value = evento?.fecha ?? fecha;
    elemento('evento-descripcion').value = evento?.descripcion ?? '';
    todoDia.checked = Boolean(evento) && !evento.hora;
    hora.value = evento?.hora?.slice(0, 5) ?? '';
    for (const campo of formulario.querySelectorAll('input, textarea')) campo.disabled = !propia;
    hora.disabled = !propia || todoDia.checked;
    hora.required = propia && !todoDia.checked;
    elemento('guardar-evento').hidden = !propia;
    elemento('eliminar-evento').hidden = !evento || !propia;
    elemento('cerrar-evento').textContent = propia ? 'Cancelar' : 'Cerrar';
    dialogo.showModal();
  }

  function pintar() {
    if (!mes) return;
    elemento('mes-calendario').textContent = mes.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1, 12);
    inicio.setDate(inicio.getDate() - (inicio.getDay() + 6) % 7);
    const dias = [];
    for (let i = 0; i < 42; i++) {
      const fecha = new Date(inicio);
      fecha.setDate(inicio.getDate() + i);
      const clave = fechaTexto(fecha);
      const dia = document.createElement('div');
      dia.className = 'dia-calendario';
      if (fecha.getMonth() !== mes.getMonth()) dia.classList.add('otro-mes');
      if (clave === hoy) dia.classList.add('es-hoy');
      const numero = document.createElement('button');
      numero.type = 'button';
      numero.className = 'numero-dia';
      numero.textContent = fecha.getDate();
      numero.setAttribute('aria-label', `Añadir evento el ${fecha.toLocaleDateString('es-ES', { dateStyle: 'full' })}`);
      numero.addEventListener('click', () => abrir(null, clave));
      dia.append(numero);
      for (const evento of eventos.filter(item => item.fecha === clave)) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'evento-calendario';
        boton.textContent = `${evento.hora ? evento.hora.slice(0, 5) + ' · ' : ''}${evento.titulo}`;
        boton.addEventListener('click', () => abrir(evento));
        dia.append(boton);
      }
      dia.addEventListener('click', evento => {
        if (evento.target === dia) abrir(null, clave);
      });
      dias.push(dia);
    }
    elemento('dias-calendario').replaceChildren(...dias);
    const proximos = eventos.filter(evento => evento.fecha >= hoy)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? ''))
      .slice(0, 3);
    elemento('eventos-inicio').replaceChildren(...proximos.map(evento => {
      const fila = document.createElement('li');
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = `${evento.titulo} · ${evento.fecha.split('-').reverse().join('/')}${evento.hora ? ' · ' + evento.hora.slice(0, 5) : ' · Todo el día'}`;
      boton.addEventListener('click', () => abrir(evento));
      fila.append(boton);
      return fila;
    }));
    if (!proximos.length) {
      const fila = document.createElement('li');
      fila.textContent = 'No hay eventos próximos.';
      elemento('eventos-inicio').append(fila);
    }
  }

  async function cargar() {
    const actual = ++revision;
    try {
      const datos = await solicitarHogares(ruta);
      if (actual !== revision) return;
      eventos = datos.eventos;
      hoy = datos.hoy;
      mes ??= new Date(`${hoy.slice(0, 7)}-01T12:00:00`);
      estado.textContent = '';
      pintar();
    } catch (fallo) {
      if (actual !== revision) return;
      estado.textContent = fallo.message;
      elemento('eventos-inicio').textContent = 'No se pudieron cargar los próximos eventos.';
    }
  }

  async function guardar(eliminar = false) {
    if (ocupado) return;
    ocupado = true;
    error.textContent = 'Guardando…';
    for (const boton of formulario.querySelectorAll('button')) boton.disabled = true;
    try {
      const datos = {
        titulo: elemento('evento-titulo').value,
        fecha: elemento('evento-fecha').value,
        hora: todoDia.checked ? null : hora.value,
        descripcion: elemento('evento-descripcion').value
      };
      const destino = editando ? `/${editando.id}/${eliminar ? 'eliminar' : 'editar'}` : '';
      await solicitarHogares(ruta + destino, eliminar ? {} : datos);
      dialogo.close();
      await cargar();
    } catch (fallo) {
      error.textContent = fallo.message;
    } finally {
      ocupado = false;
      for (const boton of formulario.querySelectorAll('button')) boton.disabled = false;
    }
  }

  formulario.addEventListener('submit', evento => { evento.preventDefault(); guardar(); });
  todoDia.addEventListener('change', () => { hora.disabled = todoDia.checked; hora.required = !todoDia.checked; });
  hora.addEventListener('click', () => {
    if (!hora.disabled && typeof hora.showPicker === 'function') {
      hora.showPicker();
    }
  });
  elemento('cerrar-evento').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('cancel', evento => { if (ocupado) evento.preventDefault(); });
  elemento('eliminar-evento').addEventListener('click', () => {
    if (confirm('¿Eliminar este evento del calendario del piso?')) guardar(true);
  });
  elemento('nuevo-evento').addEventListener('click', () => { if (hoy) abrir(); });
  for (const [boton, cambio] of [['mes-anterior', -1], ['mes-siguiente', 1]]) {
    elemento(boton).addEventListener('click', () => {
      if (!mes) return;
      mes = new Date(mes.getFullYear(), mes.getMonth() + cambio, 1, 12);
      pintar();
    });
  }
  elemento('calendario-hoy').addEventListener('click', () => {
    if (!hoy) return;
    mes = new Date(`${hoy.slice(0, 7)}-01T12:00:00`);
    pintar();
  });
  window.addEventListener('hashchange', () => {
    if (['#calendario', '#inicio'].includes(location.hash)) cargar();
  });
  cargar();
}
