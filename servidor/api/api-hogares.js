import { Router } from 'express';
import { ErrorHogar } from '../logica/hogares.js';

export function crearApiHogares(servicio, finanzas, canalAvisos) {
  const router = Router();
  router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'Envía los datos en JSON.' });
    const origen = req.get('origin');
    const origenLocal = `${req.protocol}://${req.get('host')}`;
    if (origen && origen !== origenLocal && origen !== process.env.APP_URL) {
      return res.status(403).json({ error: 'El origen de la solicitud no está permitido.' });
    }
    next();
  });

  router.get('/:id/avisos/en-vivo',async(req,res)=>{
    await servicio.consultar(req.params.id,req.usuario.email);
    res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.flushHeaders();
    res.write('retry: 2000\n\n');
    const enviar=()=>{if(!res.destroyed&&!res.writableEnded){if(res.writableLength>65536){res.end();return;}res.write('event: cambio\ndata: {}\n\n');}};
    const cancelar=canalAvisos.suscribir(req.params.id,enviar);
    enviar();
    // Bounded lifetime forces a fresh session/membership check on automatic reconnection.
    const fin=setTimeout(()=>res.end(),240000);
    const latido=setInterval(()=>{if(!res.destroyed&&!res.writableEnded)res.write(': conectado\n\n');},20000);
    res.on('close',()=>{cancelar();clearInterval(latido);clearTimeout(fin);});
  });
  router.get('/:id/avisos',async(req,res)=>res.json(await servicio.avisos(req.params.id,req.usuario.email)));
  router.post('/:id/avisos/leidos',async(req,res)=>{
    const resultado=await servicio.leerAvisos(req.params.id,req.usuario.email,req.body?.cursor);
    res.json(resultado);
  });
  router.post('/:id/avisos/:aviso',async(req,res)=>{
    const resultado=await servicio.guardarAviso(req.params.id,req.usuario.email,req.params.aviso,req.body?.texto);
    await canalAvisos.publicar(req.params.id);res.json(resultado);
  });
  router.post('/:id/avisos/:aviso/editar',async(req,res)=>{
    const resultado=await servicio.guardarAviso(req.params.id,req.usuario.email,req.params.aviso,req.body?.texto,true);
    await canalAvisos.publicar(req.params.id);res.json(resultado);
  });
  router.post('/:id/avisos/:aviso/eliminar',async(req,res)=>{
    const resultado=await servicio.guardarAviso(req.params.id,req.usuario.email,req.params.aviso,null);
    await canalAvisos.publicar(req.params.id);res.json(resultado);
  });
  router.get('/:id/normas',async(req,res)=>res.json(await servicio.normas(req.params.id,req.usuario.email)));
  router.post('/:id/normas/:norma',async(req,res)=>res.json(await servicio.guardarNorma(req.params.id,req.usuario.email,req.params.norma,req.body)));
  router.post('/:id/normas/:norma/eliminar',async(req,res)=>res.json(await servicio.guardarNorma(req.params.id,req.usuario.email,req.params.norma,null)));
  router.get('/:id/gastos', async (req,res)=>res.json(await finanzas.consultar(req.params.id,req.usuario.email)));
  router.post('/:id/gastos', async (req,res)=>res.json(await finanzas.guardar(req.params.id,req.usuario.email,req.body||{})));
  router.post('/:id/gastos/:movimiento/eliminar', async (req,res)=>res.json(await finanzas.eliminar(req.params.id,req.usuario.email,req.params.movimiento)));
  router.get('/', async (req, res) => res.json(await servicio.listar(req.usuario.email)));
  router.post('/', async (req, res) => {
    const { nombre, solicitud, moneda, foto } = req.body ?? {};
    res.status(201).json(await servicio.crear(req.usuario.email, nombre, solicitud, { moneda, foto }));
  });
  router.post('/unirse', async (req, res) => {
    res.json(await servicio.unir(req.usuario.email, req.body?.codigo));
  });
  router.get('/:id', async (req, res) => {
    res.json(await servicio.consultar(req.params.id, req.usuario.email));
  });
  router.post('/:id/invitacion', async (req, res) => {
    res.json(await servicio.renovar(req.params.id, req.usuario.email));
  });
  router.post('/:id/perfil', async (req, res) => {
    res.json(await servicio.editarPerfil(req.params.id, req.usuario.email, req.body));
  });
  router.post('/:id/abandonar', async (req, res) => {
    await servicio.abandonar(req.params.id, req.usuario.email);
    res.json({ abandonado: true });
  });
  router.get('/:id/tareas', async (req, res) => {
    res.json(await servicio.tareas(req.params.id, req.usuario.email));
  });
  router.post('/:id/tareas/sortear', async (req, res) => {
    res.status(201).json(await servicio.sortearTareas(req.params.id, req.usuario.email, req.body ?? {}));
  });
  router.get('/:id/compra', async (req, res) => res.json(await servicio.listasCompra(req.params.id, req.usuario.email)));
  router.post('/:id/compra/:lista/renombrar', async (req, res) => {
    await servicio.modificarListaCompra(req.params.id, req.usuario.email, req.params.lista, req.body?.nombre);
    res.json({ guardada: true });
  });
  router.post('/:id/compra/:lista/eliminar', async (req, res) => {
    await servicio.modificarListaCompra(req.params.id, req.usuario.email, req.params.lista, null);
    res.json({ eliminada: true });
  });
  router.post('/:id/compra/:lista/productos/:producto/estado', async (req, res) => {
    await servicio.modificarProductoCompra(req.params.id, req.usuario.email, req.params.lista, req.params.producto, req.body?.comprado);
    res.json({ guardado: true });
  });
  router.post('/:id/compra/:lista/productos/:producto/eliminar', async (req, res) => {
    await servicio.modificarProductoCompra(req.params.id, req.usuario.email, req.params.lista, req.params.producto, null);
    res.json({ eliminado: true });
  });
  router.post('/:id/compra', async (req, res) => {
    await servicio.crearListaCompra(req.params.id, req.usuario.email, req.body ?? {});
    res.status(201).json({ creada: true });
  });
  router.post('/:id/compra/:lista/productos', async (req, res) => {
    await servicio.agregarProductoCompra(req.params.id, req.usuario.email, req.params.lista, req.body ?? {});
    res.status(201).json({ agregado: true });
  });
  router.get('/:id/eventos', async (req, res) => res.json(await servicio.eventos(req.params.id, req.usuario.email)));
  router.post('/:id/eventos', async (req, res) => {
    await servicio.guardarEvento(req.params.id, req.usuario.email, req.body ?? {});
    res.status(201).json({ creado: true });
  });
  router.post('/:id/eventos/:evento/editar', async (req, res) => {
    await servicio.guardarEvento(req.params.id, req.usuario.email, req.body ?? {}, req.params.evento);
    res.json({ guardado: true });
  });
  router.post('/:id/eventos/:evento/eliminar', async (req, res) => {
    await servicio.eliminarEvento(req.params.id, req.usuario.email, req.params.evento);
    res.json({ eliminado: true });
  });
  router.post('/:id/tareas', async (req, res) => {
    await servicio.crearTarea(req.params.id, req.usuario.email, req.body ?? {});
    res.status(201).json({ creada: true });
  });
  router.post('/:id/tareas/:tarea/completar', async (req, res) => {
    await servicio.completarTarea(req.params.id, req.usuario.email, req.params.tarea, req.body?.foto);
    res.json({ completada: true });
  });
  router.post('/:id/tareas/:tarea/comentarios', async (req, res) => {
    await servicio.comentarTarea(req.params.id, req.usuario.email, req.params.tarea, req.body?.texto);
    res.status(201).json({ publicado: true });
  });
  router.post('/:id/tareas/:tarea/reasignar', async (req, res) => {
    await servicio.reasignarTarea(req.params.id, req.usuario.email, req.params.tarea, req.body?.responsable);
    res.json({ reasignada: true });
  });
  router.post('/:id/tareas/:tarea/eliminar', async (req, res) => {
    await servicio.eliminarTarea(req.params.id, req.usuario.email, req.params.tarea);
    res.json({ eliminada: true });
  });
  router.post('/:id/tareas/:tarea/ocultar', async (req, res) => {
    await servicio.ocultarTarea(req.params.id, req.usuario.email, req.params.tarea);
    res.json({ ocultada: true });
  });
  router.post('/:id/tareas/:tarea/editar', async (req, res) => {
    await servicio.editarTareaHecha(req.params.id, req.usuario.email, req.params.tarea, req.body?.titulo);
    res.json({ editada: true });
  });
  router.post('/:id/tareas/:tarea/modificar', async (req, res) => {
    await servicio.modificarTareaPendiente(req.params.id, req.usuario.email, req.params.tarea, req.body);
    res.json({ editada: true });
  });
  router.post('/:id/tareas/:tarea/renombrar', async (req, res) => {
    await servicio.renombrarTareaPendiente(req.params.id, req.usuario.email, req.params.tarea, req.body?.titulo);
    res.json({ editada: true });
  });
  router.use((error, req, res, next) => {
    if (error instanceof ErrorHogar) return res.status(error.status).json({ error: error.message });
    if (error.code === '42P01') {
      return res.status(503).json({ error: 'La función de pisos todavía no está disponible. Vuelve a intentarlo más tarde.' });
    }
    console.error('Error en hogares:', error.code ?? error.name);
    res.status(500).json({ error: 'No se pudo guardar o consultar el piso. Inténtalo de nuevo.' });
  });
  return router;
}
