import { solicitarCuenta } from '../comunicacion/rest.js';

export function prepararCuenta(usuario) {
  const porId = id => document.getElementById(id);
  const dialogo = porId('dialogo-mi-perfil');
  const formulario = porId('formulario-mi-perfil');
  const archivo = porId('archivo-foto-personal');
  const guardar = porId('guardar-mi-perfil');
  const error = porId('error-mi-perfil');
  let perfil = { ...usuario };
  let fotoNueva;
  let lectura = 0;
  let guardando = false;
  let revision = 0;
  function mostrar() {
    porId('nombre-perfil-piso').textContent = perfil.nombre;
    porId('nombre-cuenta-barra').textContent = perfil.nombre;
    porId('correo-mi-perfil').textContent = perfil.email;
    porId('saludo-inicio').textContent = `Vamos a ponernos al día ${perfil.nombre}`;
    const inicial = [...perfil.nombre.trim()][0]?.toUpperCase() ?? '?';
    for (const id of ['avatar-perfil-piso', 'avatar-cuenta-tareas']) {
      const avatar = porId(id);
      if (perfil.foto) {
        const imagen = document.createElement('img');
        imagen.alt = '';
        imagen.src = perfil.foto;
        avatar.replaceChildren(imagen);
      } else avatar.textContent = inicial;
    }
    const filaPropia = document.querySelector('#miembros-hogar li[data-propio="true"]');
    if (filaPropia) {
      const avatar = porId('avatar-cuenta-tareas').cloneNode(true);
      avatar.removeAttribute('id');
      filaPropia.replaceChildren(avatar, `${perfil.nombre} · ${filaPropia.dataset.rol === 'administrador' ? 'Administrador' : 'Miembro'}`);
    }
  }
  mostrar();
  // No sobrescribe un guardado posterior si la consulta inicial tarda en llegar.
  const consulta = revision;
  solicitarCuenta().then(datos => { if (consulta === revision) { perfil = datos; mostrar(); } })
    .catch(e => { porId('estado-mi-cuenta').textContent = e.message; });

  function vistaFoto() {
    const foto = fotoNueva === undefined ? perfil.foto : fotoNueva;
    const img = porId('vista-foto-personal');
    img.hidden = !foto;
    porId('vista-inicial-personal').hidden = Boolean(foto);
    porId('vista-inicial-personal').textContent = [...perfil.nombre.trim()][0]?.toUpperCase() ?? '?';
    if (foto) img.src = foto;
    else img.removeAttribute('src');
    porId('quitar-foto-personal').hidden = !foto;
  }
  porId('editar-mi-perfil').addEventListener('click', () => {
    ++lectura;
    formulario.reset();
    formulario.elements.nombre.value = perfil.nombre;
    porId('correo-editar-perfil').textContent = perfil.email;
    fotoNueva = undefined;
    guardar.disabled = false;
    error.textContent = '';
    vistaFoto();
    dialogo.showModal();
  });
  porId('cancelar-mi-perfil').addEventListener('click', () => dialogo.close());
  dialogo.addEventListener('cancel', e => { if (guardando) e.preventDefault(); });
  dialogo.addEventListener('close', () => { ++lectura; });
  porId('quitar-foto-personal').addEventListener('click', () => {
    ++lectura; fotoNueva = null; archivo.value = ''; guardar.disabled = false; error.textContent = ''; vistaFoto();
  });
  archivo.addEventListener('change', async () => {
    const numero = ++lectura;
    const foto = archivo.files[0];
    error.textContent = '';
    if (!foto) { guardar.disabled = false; return; }
    guardar.disabled = true;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(foto.type) || foto.size < 1 || foto.size > 600_000) throw new Error('Elige una foto JPG, PNG o WebP de hasta 600 KB.');
      const datos = await new Promise((resolve, reject) => {
        const lector = new FileReader(); lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error('No se pudo leer la foto.')); lector.readAsDataURL(foto);
      });
      if (numero === lectura) { fotoNueva = datos; vistaFoto(); }
    } catch (e) { if (numero === lectura) { archivo.value = ''; error.textContent = e.message; } }
    finally { if (numero === lectura) guardar.disabled = false; }
  });
  formulario.addEventListener('submit', async e => {
    e.preventDefault();
    if (guardando || guardar.disabled) return;
    guardando = true; ++revision;
    error.textContent = 'Guardando tu perfil…';
    const controles = [...formulario.querySelectorAll('button, input')];
    controles.forEach(c => { c.disabled = true; });
    try {
      const datos = { nombre: formulario.elements.nombre.value };
      if (fotoNueva !== undefined) datos.foto = fotoNueva;
      perfil = await solicitarCuenta(datos);
      mostrar();
      porId('estado-mi-cuenta').textContent = 'Tu perfil se ha actualizado.';
      dialogo.close();
    } catch (e) { error.textContent = e.message; }
    finally { guardando = false; controles.forEach(c => { c.disabled = false; }); }
  });
}
