import { randomUUID } from 'node:crypto';
// SSE only carries invalidation signals. Message contents always use authenticated GETs.
export function crearCanalAvisos(conexion = null) {
  const suscriptores=new Map(), origen=randomUUID();
  let cliente, reconectar, cerrado=false;
  function emitir(id) {for(const fn of suscriptores.get(id)||[])fn();}
  async function escuchar() {
    if(cerrado||!conexion)return;
    let actual;
    try {
      actual=await conexion.connect();if(cerrado){actual.release();return;}cliente=actual;
      const perdido=()=>{
        if(cliente!==actual)return;cliente=null;actual.removeAllListeners('notification');actual.removeListener('error',perdido);actual.removeListener('end',perdido);actual.release(true);
        if(!cerrado){reconectar=setTimeout(escuchar,2000);reconectar.unref?.();}
      };
      actual.on('error',perdido);actual.on('end',perdido);
      actual.on('notification',evento=>{try{const dato=JSON.parse(evento.payload);if(dato.origen!==origen&&typeof dato.id==='string')emitir(dato.id);}catch{}});
      await actual.query('LISTEN hogardu_avisos');
      // Reconcile messages missed while the database listener was disconnected.
      for(const id of suscriptores.keys())emitir(id);
    }catch{
      if(cliente===actual){cliente=null;actual?.release(true);}
      if(!cerrado){reconectar=setTimeout(escuchar,2000);reconectar.unref?.();}
    }
  }
  escuchar();
  return {
    suscribir(id,fn){if(!suscriptores.has(id))suscriptores.set(id,new Set());suscriptores.get(id).add(fn);return()=>{const lista=suscriptores.get(id);lista?.delete(fn);if(!lista?.size)suscriptores.delete(id);};},
    async publicar(id){emitir(id);if(conexion)try{await conexion.query("SELECT pg_notify('hogardu_avisos',$1)",[JSON.stringify({id,origen})]);}catch{console.error('No se pudo notificar el cambio de avisos a otras instancias.');}},
    cerrar(){cerrado=true;clearTimeout(reconectar);suscriptores.clear();if(cliente){const anterior=cliente;cliente=null;anterior.release(true);}}
  };
}
