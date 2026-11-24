import { solicitarHogares } from '../comunicacion/rest.js';

export function prepararPerfil(hogar) {
  const porId = id => document.getElementById(id);
  const dialogo = porId('dialogo-perfil-hogar');
  const formulario = porId('formulario-perfil-hogar');
  const archivo = porId('archivo-foto-hogar');
  const guardar = porId('guardar-perfil-hogar');
  const estado = porId('estado-editar-hogar');
  let fotoNueva;
  let lectura = 0;
  let guardando = false;

  function imagen(id, inicial, foto) {
    const img = porId(id);
    img.hidden = !foto;
    porId(inicial).hidden = Boolean(foto);
    if (foto) img.src = foto;
    else img.removeAttribute('src');
  }

  function mostrar() {
    porId('titulo-hogar-perfil').textContent = hogar.nombre;
    porId('nombre-piso-cabecera').textContent = hogar.nombre;
    porId('resumen-miembros-perfil').textContent = `${hogar.miembros.length} ${hogar.miembros.length === 1 ? 'compañero' : 'compañeros'}`;
    porId('moneda-configuracion-piso').textContent = `Moneda del piso · ${hogar.moneda}`;
    imagen('foto-hogar-perfil', 'inicial-hogar-perfil', hogar.foto);
    const menu = porId('foto-piso-menu');
    menu.hidden = !hogar.foto;
    if (hogar.foto) menu.src = hogar.foto;
    else menu.removeAttribute('src');
    porId('editar-perfil-hogar').hidden = hogar.rol !== 'administrador';
  }
  mostrar();

  function vistaFoto() {
    const foto = fotoNueva === undefined ? hogar.foto : fotoNueva;
    imagen('vista-foto-hogar', 'vista-inicial-hogar', foto);
    porId('quitar-foto-hogar').hidden = !foto;
  }

  porId('editar-perfil-hogar').addEventListener('click', () => {
    formulario.reset();
    formulario.elements.nombre.value = hogar.nombre;
    fotoNueva = undefined;
    ++lectura;
    estado.textContent = '';
    guardar.disabled = false;
    vistaFoto();
    dialogo.showModal();
  });
  porId('cancelar-perfil-hogar').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('cancel', evento => { if (guardando) evento.preventDefault(); });
  dialogo.addEventListener('close', () => { ++lectura; });
  porId('quitar-foto-hogar').addEventListener('click', () => {
    ++lectura;
    fotoNueva = null;
    archivo.value = '';
    guardar.disabled = false;
    estado.textContent = '';
    vistaFoto();
  });
  archivo.addEventListener('change', async () => {
    const numero = ++lectura;
    const foto = archivo.files[0];
    estado.textContent = '';
    if (!foto) { guardar.disabled = false; return; }
    guardar.disabled = true;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type) || foto.size < 1 || foto.size > 600_000) {
        throw new Error('Elige una foto JPG, PNG o WebP de hasta 600 KB.');
      }
      const datos = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error('No se pudo leer la foto. Inténtalo de nuevo.'));
        lector.readAsDataURL(foto);
      });
      if (numero !== lectura) return;
      fotoNueva = datos;
      vistaFoto();
    } catch (error) {
      if (numero !== lectura) return;
      archivo.value = '';
      estado.textContent = error.message;
    } finally {
      if (numero === lectura) guardar.disabled = false;
    }
  });
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (guardando || guardar.disabled) return;
    guardando = true;
    estado.textContent = 'Guardando los cambios…';
    const controles = [...formulario.querySelectorAll('button, input')];
    controles.forEach(control => { control.disabled = true; });
    try {
      const datos = { nombre: formulario.elements.nombre.value };
      if (fotoNueva !== undefined) datos.foto = fotoNueva;
      const actualizado = await solicitarHogares(`/${encodeURIComponent(hogar.id)}/perfil`, datos);
      Object.assign(hogar, actualizado);
      mostrar();
      porId('error-cuenta-piso').textContent = 'Los datos del piso se han actualizado.';
      dialogo.close();
    } catch (error) {
      estado.textContent = error.message;
    } finally {
      guardando = false;
      controles.forEach(control => { control.disabled = false; });
    }
  });
}
