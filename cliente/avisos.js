import { solicitarHogares } from './comunicacion/rest.js';
export function prepararAvisos(id) {
  const $=id=>document.getElementById(id),ruta='/'+encodeURIComponent(id)+'/avisos';
  const lista=$('mensajes-avisos'),form=$('enviar-aviso'),dialogo=$('dialogo-editar-aviso'),editor=$('formulario-editar-aviso');
  let cargando=false,enviando=false,editando=false,actual,solicitud=crypto.randomUUID(),cursorLeido=null,firma='',canal,pendiente=false;
  const visible=()=>location.hash==='#avisos'&&!document.hidden;
  const nodo=(tipo,texto,clase)=>{const n=document.createElement(tipo);n.textContent=texto;if(clase)n.className=clase;return n;};
  async function cargar(){if(cargando){pendiente=true;return;}if(document.hidden){pendiente=true;return;}pendiente=false;cargando=true;
    try{const datos=await solicitarHogares(ruta);
      $('punto-avisos').hidden=!datos.sinLeer;
      const nuevaFirma=JSON.stringify(datos.avisos.map(a=>[a.id,a.texto,a.editado,a.nombre]));
      if(nuevaFirma!==firma){
        const bajar=lista.scrollHeight-lista.scrollTop-lista.clientHeight<70;
        const fragmento=document.createDocumentFragment();let separador=false;
        for(const a of datos.avisos){
          if(a.nuevo&&!separador){fragmento.append(nodo('div','Mensajes nuevos','separador-avisos'));separador=true;}
          const fila=nodo('article','','mensaje-aviso'+(a.propio?' aviso-propio':''));
          const avatar=nodo('span',[...a.nombre.trim()][0]?.toUpperCase()||'?','avatar-aviso');avatar.setAttribute('aria-hidden','true');
          const contenido=document.createElement('div'),cabecera=nodo('header','','cabecera-aviso');cabecera.append(nodo('strong',a.nombre));
          const fecha=nodo('time',new Date(a.fecha).toLocaleString('es-ES',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));fecha.dateTime=a.fecha;cabecera.append(fecha);if(a.editado)cabecera.append(nodo('small','editado'));
          if(a.propio){const menu=document.createElement('details');menu.className='menu-aviso';const resumen=nodo('summary','⋯');resumen.setAttribute('aria-label','Opciones de tu aviso');const opciones=document.createElement('div'),editar=nodo('button','Editar'),eliminar=nodo('button','Eliminar');editar.type=eliminar.type='button';
            editar.addEventListener('click',()=>{menu.open=false;actual=a.id;editor.elements.texto.value=a.texto;$('error-editar-aviso').textContent='';dialogo.showModal();});
            eliminar.addEventListener('click',async()=>{if(eliminar.disabled)return;eliminar.disabled=true;try{await solicitarHogares(ruta+'/'+a.id+'/eliminar',{});await cargar();}catch(e){$('estado-avisos').textContent=e.message;}finally{eliminar.disabled=false;}});opciones.append(editar,eliminar);menu.append(resumen,opciones);cabecera.append(menu);
          }
          contenido.append(cabecera,nodo('p',a.texto));fila.append(avatar,contenido);fragmento.append(fila);
        }
        lista.replaceChildren(fragmento);firma=nuevaFirma;if(bajar||visible())lista.scrollTop=lista.scrollHeight;
      }
      $('estado-avisos').textContent=datos.avisos.length?'':'Todavía no hay avisos. Escribe el primero.';
      if(visible()&&cursorLeido!==datos.cursor){await solicitarHogares(ruta+'/leidos',{cursor:datos.cursor});if(visible()){$('punto-avisos').hidden=true;cursorLeido=datos.cursor;}}
      else if(visible())$('punto-avisos').hidden=true;
    }catch(e){$('estado-avisos').textContent=e.message;}finally{cargando=false;if(pendiente&&!document.hidden){pendiente=false;queueMicrotask(cargar);}}
  }
  form.addEventListener('submit',async e=>{e.preventDefault();if(enviando)return;enviando=true;const b=form.querySelector('button');b.disabled=true;
    try{await solicitarHogares(ruta+'/'+solicitud,{texto:form.elements.texto.value});form.reset();solicitud=crypto.randomUUID();await cargar();lista.scrollTop=lista.scrollHeight;form.elements.texto.focus();}catch(e){$('estado-avisos').textContent=e.message;}finally{enviando=false;b.disabled=false;}
  });
  $('cancelar-editar-aviso').addEventListener('click',()=>{if(!editando)dialogo.close();});dialogo.addEventListener('cancel',e=>{if(editando)e.preventDefault();});
  editor.addEventListener('submit',async e=>{e.preventDefault();if(editando)return;editando=true;const b=editor.querySelector('[type=submit]');b.disabled=true;try{await solicitarHogares(ruta+'/'+actual+'/editar',{texto:editor.elements.texto.value});dialogo.close();await cargar();}catch(e){$('error-editar-aviso').textContent=e.message;}finally{editando=false;b.disabled=false;}});
  window.addEventListener('hashchange',()=>{if(visible()){firma='';cargar();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)cargar();});window.addEventListener('focus',cargar);
  function conectar(){
    if(canal)return;
    canal=new EventSource('/api/hogares'+ruta+'/en-vivo');
    canal.addEventListener('cambio',cargar);
    canal.addEventListener('open',()=>{if($('estado-avisos').dataset.conexion==='error'){$('estado-avisos').textContent='';delete $('estado-avisos').dataset.conexion;}cargar();});
    canal.addEventListener('error',()=>{if(visible()){$('estado-avisos').textContent='Reconectando con el chat… Tus mensajes guardados se conservan.';$('estado-avisos').dataset.conexion='error';}});
  }
  window.addEventListener('pagehide',()=>{canal?.close();canal=null;});
  window.addEventListener('pageshow',()=>{conectar();cargar();});
  conectar();cargar();
}
