import { validarFoto as validarImagen } from './imagenes.js';
import { randomUUID, randomBytes, createHash } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hashCodigo = codigo => createHash('sha256').update(codigo).digest('hex');
const monedas = new Set(['EUR', 'USD', 'GBP', 'CHF', 'MXN']);
const fechaPiso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' });

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const instante = new Date(fecha);
  return !Number.isNaN(instante.valueOf()) && instante.toISOString().slice(0, 10) === fecha;
}


export class ErrorHogar extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}
function validarFoto(foto) {
  try { validarImagen(foto); }
  catch (error) { throw new ErrorHogar(error.message, 400); }
}

function validarId(id) {
  if (typeof id !== 'string' || !uuid.test(id)) throw new ErrorHogar('El piso no existe.', 404);
}

function generarInvitacion(ahora) {
  const codigo = randomBytes(10).toString('hex').toUpperCase();
  const caduca = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { codigo, hash: hashCodigo(codigo), caduca };
}

export function crearServicioHogares(repositorio, reloj = () => new Date()) {
  return {
    async modificarTareaPendiente(id, email, tarea, datos) {
      const hogar = await this.consultar(id, email);
      validarId(tarea);
      if (typeof datos.titulo !== 'string' || !datos.titulo.trim() || datos.titulo.trim().length > 100) throw new ErrorHogar('Escribe un nombre de entre 1 y 100 caracteres.', 400);
      if (!['puntual','semanal','mensual'].includes(datos.frecuencia)) throw new ErrorHogar('Elige una frecuencia válida.', 400);
      if (datos.limite && (!fechaValida(datos.limite) || datos.limite < fechaPiso.format(reloj()))) throw new ErrorHogar('Elige una fecha de hoy en adelante.', 400);
      if (!datos.limite && datos.frecuencia !== 'puntual') throw new ErrorHogar('Las tareas recurrentes necesitan una fecha de inicio.', 400);
      if (!hogar.miembros.some(m => m.id === datos.responsable)) throw new ErrorHogar('Elige un compañero del piso.', 400);
      if (!await repositorio.modificarTareaPendiente(id,email,tarea,{...datos,titulo:datos.titulo.trim(),limite:datos.limite || null},fechaPiso.format(reloj()))) throw new ErrorHogar('La tarea ya no se puede editar.', 409);
    },
    async avisos(id,email) {await this.consultar(id,email);return repositorio.listarAvisos(id,email);},
    async guardarAviso(id,email,aviso,texto,editar=false) {
      await this.consultar(id,email);validarId(aviso);
      if(texto!==null && (typeof texto!=='string'||!texto.trim()||texto.trim().length>2000)) throw new ErrorHogar('Escribe un aviso de entre 1 y 2000 caracteres.',400);
      if(!await repositorio.guardarAviso(id,email,aviso,texto===null?null:texto.trim(),editar)) throw new ErrorHogar('Solo puedes editar o eliminar tus propios avisos.',403);
      return {guardado:true};
    },
    async leerAvisos(id,email,cursor) {
      await this.consultar(id,email);
      if(typeof cursor!=='string'||!/^\d{1,18}$/.test(cursor)) throw new ErrorHogar('Lectura inválida.',400);
      await repositorio.leerAvisos(id,email,cursor);return {leidos:true};
    },
    async normas(id,email) {
      await this.consultar(id,email);
      return {normas:await repositorio.listarNormas(id,email)};
    },
    async guardarNorma(id,email,norma,datos) {
      const hogar=await this.consultar(id,email);
      if(hogar.rol!=='administrador') throw new ErrorHogar('Solo el administrador del piso puede modificar las normas.',403);
      validarId(norma);
      if(datos!==null && (typeof datos.titulo!=='string'||!datos.titulo.trim()||datos.titulo.trim().length>100||(datos.texto!==undefined && typeof datos.texto!=='string')||(datos.texto??'').trim().length>3000)) throw new ErrorHogar('Escribe un título de hasta 100 caracteres y, si lo necesitas, una descripción de hasta 3000.',400);
      if(!await repositorio.guardarNorma(id,email,norma,datos && {titulo:datos.titulo.trim(),texto:(datos.texto??'').trim()})) throw new ErrorHogar('No se pudo modificar la norma. Comprueba que sigues siendo administrador.',403);
      return {guardada:true};
    },
    async renombrarTareaPendiente(id, email, tarea, titulo) {
      validarId(id);
      validarId(tarea);
      if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 100) {
        throw new ErrorHogar('Escribe un nombre de entre 1 y 100 caracteres.', 400);
      }
      if (!await repositorio.renombrarTareaPendiente(id, email, tarea, titulo.trim())) {
        throw new ErrorHogar('No se encontró esa tarea pendiente en tu piso.', 404);
      }
    },
    async sortearTareas(id, email, datos) {
      const hogar = await this.consultar(id, email);
      validarId(datos.solicitud);
      if (!Array.isArray(datos.titulos) || !datos.titulos.length || datos.titulos.length > 200 ||
          datos.titulos.some(titulo => typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 100)) {
        throw new ErrorHogar('Añade entre 1 y 200 tareas de hasta 100 caracteres.', 400);
      }
      if (datos.limite && (!fechaValida(datos.limite) || datos.limite < fechaPiso.format(reloj()))) {
        throw new ErrorHogar('Elige una fecha límite de hoy en adelante.', 400);
      }
      if (!Array.isArray(datos.participantes) || !datos.participantes.length ||
          new Set(datos.participantes).size !== datos.participantes.length ||
          datos.participantes.some(miembro => !hogar.miembros.some(actual => actual.id === miembro))) {
        throw new ErrorHogar('Selecciona compañeros del piso sin repetirlos.', 400);
      }
      const azar = valor => hashCodigo(`${datos.solicitud}:${valor}`);
      const miembros = [...datos.participantes].sort((a, b) => azar(a).localeCompare(azar(b)));
      const titulos = datos.titulos.map((titulo, indice) => ({ titulo: titulo.trim(), indice }))
        .sort((a, b) => azar(a.indice).localeCompare(azar(b.indice)));
      const tareas = titulos.map((tarea, indice) => {
        const hash = azar(`tarea-${tarea.indice}`);
        return {
          id: `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`,
          titulo: tarea.titulo, limite: datos.limite || null, responsable: miembros[indice % miembros.length]
        };
      });
      if (!await repositorio.crearSorteo(id, email, tareas)) {
        throw new ErrorHogar('Los participantes han cambiado. Revisa el piso y vuelve a intentarlo.', 409);
      }
      return tareas.map(tarea => ({ ...tarea, nombre: hogar.miembros.find(miembro => miembro.id === tarea.responsable).nombre }));
    },
    async modificarListaCompra(id, email, lista, nombre) {
      await this.comprobarAccesoCompra(id, email);
      validarId(lista);
      if (nombre !== null && (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 60)) {
        throw new ErrorHogar('Escribe un nombre de lista de hasta 60 caracteres.', 400);
      }
      if (!await repositorio.modificarListaCompra(id, email, lista, nombre === null ? null : nombre.trim())) {
        throw new ErrorHogar('La lista no existe o ya no tienes acceso.', 404);
      }
    },
    async modificarProductoCompra(id, email, lista, producto, comprado) {
      await this.comprobarAccesoCompra(id, email);
      validarId(lista);
      validarId(producto);
      if (comprado !== null && typeof comprado !== 'boolean') {
        throw new ErrorHogar('Indica si el producto está comprado.', 400);
      }
      if (!await repositorio.modificarProductoCompra(id, email, lista, producto, comprado)) {
        throw new ErrorHogar('La lista no existe o ya no tienes acceso.', 404);
      }
    },
    async listasCompra(id, email) {
      await this.comprobarAccesoCompra(id, email);
      return repositorio.listasCompra(id, email);
    },
    async comprobarAccesoCompra(id, email) {
      validarId(id);
      const pisos = await repositorio.listar(email);
      if (!pisos.some(piso => piso.id === id)) {
        throw new ErrorHogar('El piso no existe o no formas parte de él.', 404);
      }
    },
    async crearListaCompra(id, email, datos) {
      await this.comprobarAccesoCompra(id, email);
      validarId(datos.id);
      if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 60) {
        throw new ErrorHogar('Escribe un nombre de lista de hasta 60 caracteres.', 400);
      }
      const productos = datos.producto ? [this.validarProductoCompra(datos.producto)] : [];
      if (!await repositorio.guardarListaCompra(id, email, { id: datos.id, nombre: datos.nombre.trim(), productos })) {
        throw new ErrorHogar('No se pudo crear la lista.', 403);
      }
    },
    validarProductoCompra(datos) {
      validarId(datos.id);
      if (typeof datos.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 100 ||
          typeof datos.cantidad !== 'string' || datos.cantidad.trim().length > 40) {
        throw new ErrorHogar('Escribe un producto de hasta 100 caracteres y una cantidad opcional de hasta 40.', 400);
      }
      return { id: datos.id, nombre: datos.nombre.trim(), cantidad: datos.cantidad.trim() };
    },
    async agregarProductoCompra(id, email, lista, datos) {
      await this.comprobarAccesoCompra(id, email);
      validarId(lista);
      const producto = this.validarProductoCompra(datos);
      if (!await repositorio.agregarProductoCompra(id, email, lista, producto)) {
        throw new ErrorHogar('La lista no existe o ya no tienes acceso.', 404);
      }
    },
    async eventos(id, email) {
      await this.consultar(id, email);
      return { eventos: await repositorio.eventos(id, email), hoy: fechaPiso.format(reloj()) };
    },
    async guardarEvento(id, email, datos, eventoId = null) {
      await this.consultar(id, email);
      if (eventoId) validarId(eventoId);
      if (typeof datos.titulo !== 'string' || !datos.titulo.trim() || datos.titulo.trim().length > 100) {
        throw new ErrorHogar('Escribe un título de hasta 100 caracteres.', 400);
      }
      if (!fechaValida(datos.fecha)) throw new ErrorHogar('Elige una fecha válida.', 400);
      if (datos.hora != null && datos.hora !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(datos.hora)) {
        throw new ErrorHogar('Elige una hora válida.', 400);
      }
      if (typeof datos.descripcion !== 'string' || datos.descripcion.length > 1000) {
        throw new ErrorHogar('La descripción admite hasta 1000 caracteres.', 400);
      }
      const guardado = await repositorio.guardarEvento(id, email, {
        id: eventoId ?? randomUUID(), titulo: datos.titulo.trim(), fecha: datos.fecha,
        hora: datos.hora || null, descripcion: datos.descripcion.trim()
      }, Boolean(eventoId));
      if (!guardado) throw new ErrorHogar('Solo puedes modificar tus propios eventos.', 403);
    },
    async eliminarEvento(id, email, evento) {
      await this.consultar(id, email);
      validarId(evento);
      if (!await repositorio.eliminarEvento(id, email, evento)) {
        throw new ErrorHogar('Solo puedes eliminar tus propios eventos.', 403);
      }
    },
    listar(email) {
      return repositorio.listar(email);
    },
    async crear(email, nombre, solicitud, { moneda = 'EUR', foto = null } = {}) {
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 30) {
        throw new ErrorHogar('Escribe un nombre para el piso de hasta 30 caracteres.', 400);
      }
      if (typeof solicitud !== 'string' || !uuid.test(solicitud)) {
        throw new ErrorHogar('No se pudo identificar la solicitud. Recarga e inténtalo otra vez.', 400);
      }
      if (!monedas.has(moneda)) throw new ErrorHogar('Selecciona una moneda válida.', 400);
      validarFoto(foto);
      const invitacion = generarInvitacion(reloj());
      const hogar = await repositorio.crear(
        { id: randomUUID(), nombre: nombre.trim(), solicitud, moneda, foto }, email, invitacion
      );
      return {
        id: hogar.id, nombre: hogar.nombre, rol: hogar.rol,
        invitacion: hogar.nuevo ? { codigo: invitacion.codigo, caduca: invitacion.caduca } : null
      };
    },
    async consultar(id, email) {
      validarId(id);
      const hogar = await repositorio.consultar(id, email);
      if (!hogar) throw new ErrorHogar('El piso no existe o no formas parte de él.', 404);
      return hogar;
    },
    async editarPerfil(id, email, datos) {
      const hogar = await this.consultar(id, email);
      if (hogar.rol !== 'administrador') {
        throw new ErrorHogar('Solo el administrador del piso puede cambiar su nombre y su foto.', 403);
      }
      if (typeof datos?.nombre !== 'string' || !datos.nombre.trim() || datos.nombre.trim().length > 30) {
        throw new ErrorHogar('Escribe un nombre para el piso de hasta 30 caracteres.', 400);
      }
      const cambios = { nombre: datos.nombre.trim() };
      if (Object.hasOwn(datos, 'foto')) {
        validarFoto(datos.foto);
        cambios.foto = datos.foto;
      }
      if (!await repositorio.editarPerfil(id, email, cambios)) {
        throw new ErrorHogar('No se pudo guardar. Comprueba que sigues siendo administrador del piso.', 403);
      }
      return this.consultar(id, email);
    },
    async unir(email, codigo) {
      if (typeof codigo !== 'string' || !/^[A-F0-9]{20}$/.test(codigo.trim().toUpperCase())) {
        throw new ErrorHogar('El código no es válido o ha caducado.', 400);
      }
      const id = await repositorio.unir(hashCodigo(codigo.trim().toUpperCase()), email, reloj());
      if (!id) throw new ErrorHogar('El código no es válido o ha caducado.', 400);
      return this.consultar(id, email);
    },
    async tareas(id, email) {
      const hogar = await this.consultar(id, email);
      const hoy = fechaPiso.format(reloj());
      const turnos = await repositorio.prepararTurnos(id, email, hoy);
      const tareas = (await repositorio.listarTareas(id, email)).map(tarea => {
        const tarde = Boolean(tarea.limite && (tarea.completada ?? hoy) > tarea.limite);
        return { ...tarea, tarde, puntos: tarde ? -1 : Number(Boolean(tarea.completada)) };
      });
      const puntos = tareas.reduce((total, tarea) => total + (tarea.propia ? tarea.puntos : 0), 0);
      const mes = hoy.slice(0, 7);
      const ranking = hogar.miembros.map(miembro => ({
        id: miembro.id, nombre: miembro.nombre, propia: miembro.propia,
        puntos: tareas.filter(tarea => tarea.responsableId === miembro.id && (tarea.limite ?? tarea.completada ?? '').startsWith(mes))
          .reduce((total, tarea) => total + tarea.puntos, 0)
      })).sort((a, b) => b.puntos - a.puntos || a.nombre.localeCompare(b.nombre, 'es'));
      return { tareas: tareas.filter(tarea => !tarea.oculta), puntos, hoy, turnos, ranking, mes };
    },
    async crearTarea(id, email, { titulo, limite, responsable = null, frecuencia = 'puntual', participantes = null }) {
      validarId(id);
      if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 100) {
        throw new ErrorHogar('Escribe un título de hasta 100 caracteres.', 400);
      }
      if (!fechaValida(limite) || limite < fechaPiso.format(reloj())) {
        throw new ErrorHogar('Elige una fecha límite de hoy en adelante.', 400);
      }
      if (responsable !== null) validarId(responsable);
      if (!['puntual', 'semanal', 'mensual'].includes(frecuencia)) throw new ErrorHogar('Elige una frecuencia válida.', 400);
      if (participantes !== null && (!Array.isArray(participantes) || !participantes.length ||
          participantes.some(miembro => typeof miembro !== 'string' || !uuid.test(miembro)) ||
          new Set(participantes).size !== participantes.length)) {
        throw new ErrorHogar('Elige los participantes del turno sin repetirlos.', 400);
      }
      const diaMes = frecuencia === 'mensual' ? Number(limite.slice(-2)) : null;
      const tarea = { id: randomUUID(), titulo: titulo.trim(), limite, responsable, participantes, diaMes };
      const creada = frecuencia === 'puntual'
        ? await repositorio.crearTarea(id, email, tarea)
        : await repositorio.crearTurno(id, email, tarea);
      if (!creada) {
        throw new ErrorHogar('Solo puedes asignar tareas a miembros del piso.', 403);
      }
    },
    async reasignarTarea(id, email, tarea, responsable) {
      validarId(id);
      validarId(tarea);
      validarId(responsable);
      if (!await repositorio.reasignarTarea(id, email, tarea, responsable, fechaPiso.format(reloj()))) {
        throw new ErrorHogar('Solo se pueden reasignar tareas del piso pendientes y sin vencer.', 403);
      }
    },
    async eliminarTarea(id, email, tarea) {
      validarId(id);
      validarId(tarea);
      if (!await repositorio.eliminarTarea(id, email, tarea, fechaPiso.format(reloj()))) {
        throw new ErrorHogar('Solo se pueden eliminar tareas hechas o pendientes sin vencer de tu piso.', 404);
      }
    },
    async ocultarTarea(id, email, tarea) {
      validarId(id);
      validarId(tarea);
      if (!await repositorio.ocultarTarea(id, email, tarea)) {
        throw new ErrorHogar('No se encontró esa tarea hecha en tu piso.', 404);
      }
    },
    async editarTareaHecha(id, email, tarea, titulo) {
      validarId(id);
      validarId(tarea);
      if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 100) {
        throw new ErrorHogar('Escribe un nombre de entre 1 y 100 caracteres.', 400);
      }
      if (!await repositorio.editarTareaHecha(id, email, tarea, titulo.trim())) {
        throw new ErrorHogar('No se encontró esa tarea hecha en tu piso.', 404);
      }
    },
    async completarTarea(id, email, tarea, foto = null) {
      validarId(id);
      validarId(tarea);
      validarFoto(foto);
      if (!await repositorio.completarTarea(id, email, tarea, fechaPiso.format(reloj()), foto)) {
        throw new ErrorHogar('La tarea ya está hecha o no puedes completarla. La foto solo se adjunta al completarla.', 404);
      }
    },
    async comentarTarea(id, email, tarea, texto) {
      validarId(id);
      validarId(tarea);
      if (typeof texto !== 'string' || !texto.trim() || texto.trim().length > 500) {
        throw new ErrorHogar('Escribe un comentario de entre 1 y 500 caracteres.', 400);
      }
      if (!await repositorio.comentarTarea(id, email, tarea, texto.trim())) {
        throw new ErrorHogar('Solo puedes comentar fotos de tareas completadas de tu piso.', 404);
      }
    },
    async abandonar(id, email) {
      validarId(id);
      const resultado = await repositorio.abandonar(id, email);
      if (resultado === 'administrador') {
        throw new ErrorHogar('El piso necesita un administrador. Para salir, otro miembro debe asumir ese rol.', 409);
      }
    },
    async renovar(id, email) {
      validarId(id);
      const invitacion = generarInvitacion(reloj());
      if (!await repositorio.renovar(id, email, invitacion)) {
        throw new ErrorHogar('Solo el administrador del piso puede crear invitaciones.', 403);
      }
      return { codigo: invitacion.codigo, caduca: invitacion.caduca };
    }
  };
}
