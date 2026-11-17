import { solicitarHogares } from './comunicacion/rest.js';

export function prepararCompra(id) {
  const porId = nombre => document.getElementById(nombre);
  const ruta = `/${encodeURIComponent(id)}/compra`;
  const dialogo = porId('dialogo-compra');
  const formulario = porId('formulario-compra');
  const editor = porId('editor-producto-compra');
  const nombreLista = porId('nombre-lista-compra');
  const nombreProducto = porId('nombre-producto-compra');
  const cantidad = porId('cantidad-producto-compra');
  const error = porId('error-compra');
  let listas = [];
  let listaDestino;
  let modoLista = true;
  let ocupado = false;
  let solicitud;
  let revision = 0;
  let listaAbierta = null;

  function abrir(crearLista, lista = null) {
    if (ocupado) return;
    modoLista = crearLista;
    listaDestino = lista;
    solicitud = crypto.randomUUID();
    formulario.reset();
    error.textContent = '';
    porId('campo-lista-compra').hidden = !crearLista;
    porId('campos-producto-compra').hidden = crearLista;
    nombreLista.required = crearLista;
    nombreProducto.required = !crearLista;
    porId('titulo-dialogo-compra').textContent = crearLista ? 'Crear Nueva Lista' : 'Añadir Producto';
    porId('guardar-compra').textContent = crearLista ? 'Crear lista' : '↑';
    porId('guardar-compra').setAttribute('aria-label', crearLista ? 'Crear lista' : 'Añadir producto');
    porId('destino-producto-compra').textContent = lista
      ? `Lista: ${lista.nombre}` : 'Crearemos una nueva lista con este producto.';
    if (crearLista) {
      editor.hidden = true;
      dialogo.append(formulario);
      if (!dialogo.open) dialogo.showModal();
    } else {
      dialogo.close();
      editor.append(formulario);
      editor.hidden = false;
    }
    (crearLista ? nombreLista : nombreProducto).focus();
  }

  function pintar() {
    const seleccionada = listas.find(lista => lista.id === listaAbierta);
    porId('compra').querySelector('.cabecera-compra .acciones-compra').hidden = Boolean(seleccionada);
    const tituloVista = porId('compra').querySelector('.cabecera-compra h2');
    tituloVista.hidden = Boolean(seleccionada);
    tituloVista.textContent = 'Todas las Listas';
    const contenedor = porId('listas-compra');
    contenedor.replaceChildren();
    if (seleccionada) {
      const volver = document.createElement('button');
      volver.type = 'button';
      volver.className = 'volver-listas-compra';
      volver.textContent = '← Todas las Listas';
      volver.addEventListener('click', () => {
        if (ocupado) return;
        editor.hidden = true;
        listaAbierta = null;
        pintar();
      });
      contenedor.append(volver);
    }
    contenedor.append(...(seleccionada ? [seleccionada] : listas).map(lista => {
      const bloque = document.createElement('section');
      bloque.className = 'lista-compra';
      if (!seleccionada) {
        bloque.classList.add('resumen-lista-compra');
        const menu = document.createElement('details');
        menu.className = 'menu-lista-compra';
        const puntos = document.createElement('summary');
        puntos.textContent = '⋯';
        puntos.setAttribute('aria-label', `Opciones de ${lista.nombre}`);
        const opciones = document.createElement('div');
        for (const borrar of [false, true]) {
          const boton = document.createElement('button');
          boton.type = 'button';
          boton.textContent = borrar ? 'Eliminar lista' : 'Cambiar nombre';
          boton.addEventListener('click', async () => {
            let nombre = null;
            if (!borrar) {
              menu.open = false;
              menu.hidden = true;
              entrar.hidden = true;
              const edicion = document.createElement('form');
              edicion.className = 'editar-nombre-lista';
              const campo = document.createElement('input');
              campo.value = lista.nombre;
              campo.maxLength = 60;
              campo.required = true;
              campo.setAttribute('aria-label', 'Nombre de la lista');
              const guardar = document.createElement('button');
              guardar.type = 'submit';
              guardar.textContent = '✓';
              guardar.setAttribute('aria-label', 'Guardar nombre');
              const cancelar = document.createElement('button');
              cancelar.type = 'button';
              cancelar.textContent = '✕';
              cancelar.setAttribute('aria-label', 'Cancelar edición');
              function cerrarEdicion() {
                edicion.remove();
                menu.hidden = false;
                entrar.hidden = false;
                puntos.focus();
              }
              cancelar.addEventListener('click', cerrarEdicion);
              campo.addEventListener('input', () => campo.setCustomValidity(''));
              campo.addEventListener('keydown', evento => {
                if (evento.key === 'Escape') { evento.preventDefault(); cerrarEdicion(); }
              });
              edicion.addEventListener('submit', async evento => {
                evento.preventDefault();
                const nuevoNombre = campo.value.trim();
                campo.setCustomValidity(nuevoNombre ? '' : 'Escribe un nombre para la lista.');
                if (!campo.reportValidity()) return;
                for (const control of [campo, guardar, cancelar]) control.disabled = true;
                try {
                  await solicitarHogares(`${ruta}/${lista.id}/renombrar`, { nombre: nuevoNombre });
                  ++revision;
                  lista.nombre = nuevoNombre;
                  pintar();
                } catch (fallo) {
                  porId('estado-compra').textContent = fallo.message;
                } finally {
                  for (const control of [campo, guardar, cancelar]) control.disabled = false;
                }
              });
              edicion.append(campo, guardar, cancelar);
              bloque.append(edicion);
              campo.focus();
              campo.select();
              return;
            }
            for (const accion of opciones.querySelectorAll('button')) accion.disabled = true;
            try {
              await solicitarHogares(`${ruta}/${lista.id}/${borrar ? 'eliminar' : 'renombrar'}`, borrar ? {} : { nombre });
              ++revision;
              if (borrar) listas = listas.filter(item => item.id !== lista.id);
              else lista.nombre = nombre;
              pintar();
            } catch (fallo) {
              porId('estado-compra').textContent = fallo.message;
            } finally {
              for (const accion of opciones.querySelectorAll('button')) accion.disabled = false;
            }
          });
          opciones.append(boton);
        }
        menu.append(puntos, opciones);
        const entrar = document.createElement('button');
        entrar.type = 'button';
        entrar.className = 'abrir-lista-compra';
        const nombre = document.createElement('strong');
        nombre.textContent = lista.nombre;
        const resumen = document.createElement('span');
        resumen.textContent = `${lista.productos.length} productos →`;
        entrar.append(nombre, resumen);
        entrar.addEventListener('click', () => { listaAbierta = lista.id; pintar(); });
        bloque.append(menu, entrar);
        return bloque;
      }
      const cabecera = document.createElement('div');
      cabecera.className = 'cabecera-lista-compra';
      const titulo = document.createElement('h2');
      titulo.textContent = lista.nombre;
      const agregar = document.createElement('button');
      agregar.type = 'button';
      agregar.className = 'anadir-producto-linea';
      const signo = document.createElement('span');
      signo.textContent = '+';
      signo.setAttribute('aria-hidden', 'true');
      agregar.append(signo, ' Añadir producto');
      agregar.addEventListener('click', () => abrir(false, lista));
      cabecera.append(titulo);
      const productos = document.createElement('ul');
      for (const producto of lista.productos) {
        const fila = document.createElement('li');
        fila.classList.toggle('producto-comprado', Boolean(producto.comprado));
        const eliminar = document.createElement('button');
        eliminar.type = 'button';
        eliminar.className = 'eliminar-producto-compra';
        eliminar.setAttribute('aria-label', `Eliminar ${producto.nombre}`);
        eliminar.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
        const marcar = document.createElement('input');
        marcar.type = 'checkbox';
        marcar.className = 'marcar-producto-compra';
        marcar.checked = Boolean(producto.comprado);
        marcar.setAttribute('aria-label', `Comprado: ${producto.nombre}`);
        async function modificar(borrar) {
          eliminar.disabled = true;
          marcar.disabled = true;
          const nuevoEstado = marcar.checked;
          if (borrar) fila.hidden = true;
          else fila.classList.toggle('producto-comprado', nuevoEstado);
          porId('estado-compra').textContent = '';
          try {
            await solicitarHogares(`${ruta}/${lista.id}/productos/${producto.id}/${borrar ? 'eliminar' : 'estado'}`,
              borrar ? {} : { comprado: nuevoEstado });
            ++revision;
            if (borrar) lista.productos = lista.productos.filter(item => item.id !== producto.id);
            else producto.comprado = nuevoEstado;
            pintar();
          } catch (fallo) {
            fila.hidden = false;
            fila.classList.toggle('producto-comprado', Boolean(producto.comprado));
            marcar.checked = Boolean(producto.comprado);
            porId('estado-compra').textContent = fallo.message;
          } finally {
            eliminar.disabled = false;
            marcar.disabled = false;
          }
        }
        eliminar.addEventListener('click', () => modificar(true));
        marcar.addEventListener('change', () => modificar(false));
        const nombre = document.createElement('span');
        nombre.className = 'nombre-producto-fila';
        nombre.textContent = producto.nombre;
        const unidades = document.createElement('span');
        unidades.className = 'cantidad-compra';
        unidades.textContent = producto.cantidad;
        fila.append(eliminar, marcar, nombre, unidades);
        productos.append(fila);
      }
      bloque.append(cabecera, productos);
      if (!lista.productos.length) {
        const vacia = document.createElement('p');
        vacia.textContent = 'Añade el primer producto a esta lista.';
        bloque.append(vacia);
      }
      bloque.append(agregar);
      return bloque;
    }));
    porId('estado-compra').textContent = listas.length ? '' : 'Todavía no hay listas. Crea una o añade un producto para empezar.';
  }

  async function cargar() {
    const actual = ++revision;
    try {
      const resultado = await solicitarHogares(ruta);
      if (actual !== revision) return;
      listas = resultado;
      pintar();
    } catch (fallo) {
      if (actual === revision) porId('estado-compra').textContent = fallo.message;
    }
  }

  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (ocupado) return;
    const nombre = (modoLista ? nombreLista.value : nombreProducto.value).trim();
    if (!nombre) {
      error.textContent = modoLista ? 'Escribe un nombre para la lista.' : 'Escribe el nombre del producto.';
      return;
    }
    ocupado = true;
    error.textContent = 'Guardando…';
    for (const control of formulario.querySelectorAll('input, button')) control.disabled = true;
    let creada;
    try {
      if (modoLista) {
        creada = { id: solicitud, nombre, productos: [] };
        await solicitarHogares(ruta, creada);
        listaAbierta = creada.id;
        if (!listas.some(lista => lista.id === creada.id)) listas.push(creada);
      } else {
        const producto = { id: solicitud, nombre, cantidad: cantidad.value.trim() };
        if (listaDestino) {
          await solicitarHogares(`${ruta}/${listaDestino.id}/productos`, producto);
        } else {
          const nombreAutomatico = `Compra ${new Date().toLocaleDateString('es-ES')}`;
          listaDestino = { id: solicitud, nombre: nombreAutomatico };
          try {
            await solicitarHogares(ruta, { ...listaDestino, producto });
          } catch (fallo) {
            listaDestino = null;
            throw fallo;
          }
        }
        listaAbierta = listaDestino.id;
        let guardada = listas.find(lista => lista.id === listaDestino.id);
        if (!guardada) {
          guardada = { ...listaDestino, productos: [] };
          listas.push(guardada);
        }
        if (!guardada.productos.some(item => item.id === producto.id)) guardada.productos.push(producto);
      }
      ++revision;
      pintar();
      error.textContent = '';
      if (!modoLista) {
        nombreProducto.value = '';
        cantidad.value = '';
        solicitud = crypto.randomUUID();
        editor.hidden = true;
        porId('destino-producto-compra').textContent = `Lista: ${listaDestino.nombre}`;
      }
    } catch (fallo) {
      error.textContent = fallo.message;
    } finally {
      ocupado = false;
      for (const control of formulario.querySelectorAll('input, button')) control.disabled = false;
    }
    if (creada && !error.textContent) abrir(false, creada);
    else if (!error.textContent) porId('compra').querySelector('.anadir-producto-linea')?.focus();
  });

  porId('nueva-lista-compra').addEventListener('click', () => abrir(true));
  porId('nuevo-producto-compra').addEventListener('click', () =>
    abrir(false, listas.find(lista => lista.id === listaAbierta) ?? null));
  porId('cancelar-compra').addEventListener('click', () => {
    if (ocupado) return;
    dialogo.close();
    editor.hidden = true;
    porId('compra').querySelector('.anadir-producto-linea')?.focus();
  });
  dialogo.addEventListener('cancel', evento => { if (ocupado) evento.preventDefault(); });
  window.addEventListener('hashchange', () => {
    editor.hidden = true;
    if (location.hash === '#compra') { listaAbierta = null; cargar(); }
  });
  cargar();
}
