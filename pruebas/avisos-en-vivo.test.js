import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { crearCanalAvisos } from '../servidor/avisos-en-vivo.js';
import { crearApiHogares } from '../servidor/api-hogares.js';
import { ErrorHogar } from '../servidor/hogares.js';
test('el canal aísla pisos y elimina suscripciones cerradas',async()=>{
 const canal=crearCanalAvisos();let a=0,b=0;const cerrar=canal.suscribir('uno',()=>a++);canal.suscribir('dos',()=>b++);
 await canal.publicar('uno');assert.equal(a,1);assert.equal(b,0);cerrar();await canal.publicar('uno');assert.equal(a,1);canal.cerrar();
});
test('SSE entrega cambios después del guardado, reconecta y exige pertenecer al piso',async t=>{
 const canal=crearCanalAvisos(),guardados=[];
 const servicio={consultar:async id=>{if(id==='ajeno')throw new ErrorHogar('No autorizado',404);return {};},guardarAviso:async(id,email,aviso,texto)=>{guardados.push(texto);return {guardado:true};}};
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.usuario={email:'prueba@example.com'};next();});app.use('/api/hogares',crearApiHogares(servicio,null,canal));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{canal.cerrar();server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port+'/api/hogares';
 assert.equal((await fetch(base+'/ajeno/avisos/en-vivo')).status,404);
 const controlador=new AbortController();const respuesta=await fetch(base+'/uno/avisos/en-vivo',{signal:controlador.signal});assert.match(respuesta.headers.get('content-type'),/text\/event-stream/);
 const lector=respuesta.body.getReader(),decoder=new TextDecoder();let texto=decoder.decode((await lector.read()).value);assert.match(texto,/event: cambio/);
 const envio=await fetch(base+'/uno/avisos/123',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({texto:'Mensaje instantáneo'})});assert.equal(envio.status,200);assert.equal(guardados[0],'Mensaje instantáneo');
 const siguiente=await Promise.race([lector.read(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('No llegó el evento SSE')),1500);timer.unref();})]);assert.match(decoder.decode(siguiente.value),/event: cambio/);controlador.abort();
 const reconexion=new AbortController();const otra=await fetch(base+'/uno/avisos/en-vivo',{signal:reconexion.signal});assert.match(decoder.decode((await otra.body.getReader().read()).value),/event: cambio/);reconexion.abort();
});
