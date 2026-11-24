import { solicitarHogares } from '../comunicacion/rest.js';
export function prepararNormas(id,hogar) {
  const $=id=>document.getElementById(id),ruta='/'+encodeURIComponent(id)+'/normas',administrador=hogar.rol==='administrador';
  const formulario=$('formulario-norma'),dialogo=$('dialogo-norma');let normaActual,ocupado=false,revision=0;
  $('anadir-norma').hidden=!administrador;
  $('ayuda-normas').textContent=administrador?'Publica los acuerdos de convivencia de vuestro piso.':'Aquí puedes consultar los acuerdos del piso. Solo el administrador puede modificarlos.';
  async function cargar(){const version=++revision;try{const {normas}=await solicitarHogares(ruta);if(version!==revision)return;$('lista-normas').replaceChildren(...normas.map(n=>{
    const fila=document.createElement('li'),cabecera=document.createElement('div'),titulo=document.createElement('h3'),texto=document.createElement('p');titulo.textContent=n.titulo;texto.textContent=n.texto;cabecera.className='cabecera-norma';cabecera.append(titulo);
    if(administrador){const menu=document.createElement('details'),resumen=document.createElement('summary'),opciones=document.createElement('div');menu.className='menu-norma';resumen.textContent='⋯';resumen.setAttribute('aria-label','Opciones de '+n.titulo);
      const editar=document.createElement('button');editar.textContent='Editar';editar.addEventListener('click',()=>{menu.open=false;abrir(n);});
      const eliminar=document.createElement('button');eliminar.textContent='Eliminar';eliminar.addEventListener('click',async()=>{if(ocupado)return;ocupado=true;eliminar.disabled=true;try{await solicitarHogares(ruta+'/'+n.id+'/eliminar',{});await cargar();}catch(e){$('estado-normas').textContent=e.message;}finally{ocupado=false;eliminar.disabled=false;}});opciones.append(editar,eliminar);menu.append(resumen,opciones);cabecera.append(menu);
    }
    fila.append(cabecera);if(n.texto)fila.append(texto);return fila;
  }));$('estado-normas').textContent=normas.length?'':(administrador?'Todavía no hay normas. Añade el primer acuerdo del piso.':'El administrador todavía no ha añadido normas.');}catch(e){$('estado-normas').textContent=e.message;}}
  function abrir(n=null){normaActual=n?.id||crypto.randomUUID();formulario.reset();formulario.elements.titulo.value=n?.titulo||'';formulario.elements.texto.value=n?.texto||'';$('titulo-dialogo-norma').textContent=n?'Editar norma':'Añadir norma';$('error-norma').textContent='';dialogo.showModal();}
  $('anadir-norma').addEventListener('click',()=>abrir());$('cancelar-norma').addEventListener('click',()=>{if(!ocupado)dialogo.close();});dialogo.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
  formulario.addEventListener('submit',async e=>{e.preventDefault();if(ocupado)return;ocupado=true;const guardar=formulario.querySelector('[type=submit]');guardar.disabled=true;try{await solicitarHogares(ruta+'/'+normaActual,Object.fromEntries(new FormData(formulario)));dialogo.close();await cargar();}catch(e){$('error-norma').textContent=e.message;}finally{ocupado=false;guardar.disabled=false;}});
  window.addEventListener('hashchange',()=>{if(location.hash==='#normas')cargar();});window.addEventListener('focus',()=>{if(location.hash==='#normas'&&!ocupado)cargar();});if(location.hash==='#normas')cargar();
}
