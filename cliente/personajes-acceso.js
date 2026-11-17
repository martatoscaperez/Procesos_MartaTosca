const panel = document.querySelector('.personajes-acceso');
const reducirMovimiento = matchMedia('(prefers-reduced-motion: reduce)');
const trayectorias = [
  [.15, .20, 72, 49],
  [.78, .73, -55, -68],
  [.70, .24, -94, 36],
  [.42, .85, 46, -83],
];
const colores = ['#ff82ce', '#49eaff', '#bd9aff', '#5cff38'];
const figuras = [...panel.querySelectorAll('button')].map((boton, indice) => {
  const [inicioX, inicioY, vx, vy] = trayectorias[indice];
  return { boton, inicioX, inicioY, vx, vy, x: null, y: null };
});
let cuadro = 0;
let anterior;
const esfera = panel.querySelector('canvas');
const contexto = esfera.getContext('2d');
let giro = .2;

function dibujarEsfera(tiempo) {
  giro += tiempo * .85;
  contexto.clearRect(0, 0, 128, 128);
  contexto.strokeStyle = '#5cff38';
  contexto.beginPath();
  contexto.arc(64, 64, 59, 0, Math.PI * 2);
  contexto.stroke();

  function trazar(latitud, longitud) {
    contexto.beginPath();
    let visible = false;
    for (let paso = 0; paso <= 120; paso++) {
      const lat = latitud(paso / 120);
      const lon = longitud(paso / 120);
      const x = Math.cos(lat) * Math.sin(lon);
      const profundidad = Math.cos(lat) * Math.cos(lon);
      const y = Math.sin(lat);
      const delante = profundidad * .94 - y * .34 >= 0;
      if (delante) {
        const px = 64 + 59 * x;
        const py = 64 + 59 * (y * .94 + profundidad * .34);
        if (visible) contexto.lineTo(px, py);
        else contexto.moveTo(px, py);
      }
      visible = delante;
    }
    contexto.stroke();
  }

  for (let i = 1; i < 12; i++) trazar(() => Math.PI * (i / 12 - .5), t => t * Math.PI * 2);
  for (let i = 0; i < 18; i++) trazar(t => Math.PI * (t - .5), () => giro + i * Math.PI / 9);
}

function mover(figura, eje, velocidad, limite, tiempo) {
  const siguiente = figura[eje] + figura[velocidad] * tiempo;
  if (siguiente <= 0) figura[velocidad] = Math.abs(figura[velocidad]);
  if (siguiente >= limite) figura[velocidad] = -Math.abs(figura[velocidad]);
  figura[eje] = Math.max(0, Math.min(limite, siguiente));
}

function dibujar(instante) {
  cuadro = 0;
  const { clientWidth: ancho, clientHeight: alto } = panel;
  if (!ancho || !alto) {
    anterior = undefined;
    return;
  }
  const quieto = reducirMovimiento.matches;
  const tiempo = quieto || anterior === undefined ? 0 : Math.min((instante - anterior) / 1000, .05);
  anterior = quieto ? undefined : instante;

  for (const figura of figuras) {
    const limitesX = Math.max(0, ancho - figura.boton.offsetWidth);
    const limitesY = Math.max(0, alto - figura.boton.offsetHeight);
    figura.x ??= limitesX * figura.inicioX;
    figura.y ??= limitesY * figura.inicioY;
    const vx = figura.vx;
    mover(figura, 'x', 'vx', limitesX, tiempo);
    if (tiempo && limitesX && vx !== figura.vx) {
      figura.boton.style.setProperty('--orientacion', figura.vx > 0 ? '-1' : '1');
    }
    mover(figura, 'y', 'vy', limitesY, tiempo);
    figura.boton.style.transform = `translate(${figura.x}px, ${figura.y}px)`;
  }
  dibujarEsfera(tiempo);
  if (!quieto) actualizar();
}

function actualizar() {
  if (!cuadro) cuadro = requestAnimationFrame(dibujar);
}

new ResizeObserver(actualizar).observe(panel);
figuras.forEach((figura, indice) => {
  const { boton } = figura;
  const imagen = boton.firstElementChild;
  imagen.addEventListener('load', actualizar);
  boton.addEventListener('click', () => {
    const quieto = reducirMovimiento.matches;
    if (!quieto) {
      figura.vx *= -1;
      figura.vy *= -1;
    }
    imagen.animate([{ filter: `drop-shadow(0 0 12px ${colores[indice]}) brightness(1.6)` },
      { filter: 'none' }], { duration: 380 });
    if (quieto) return;

    for (let i = 0; i < 8; i++) {
      const angulo = i * Math.PI / 4;
      const chispa = document.createElement('span');
      chispa.className = 'chispa-acceso';
      chispa.setAttribute('aria-hidden', 'true');
      chispa.style.color = colores[indice];
      chispa.style.left = `${figura.x + boton.offsetWidth / 2}px`;
      chispa.style.top = `${figura.y + boton.offsetHeight / 2}px`;
      panel.append(chispa);
      const destello = chispa.animate([
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(${Math.cos(angulo) * 56}px, ${Math.sin(angulo) * 56}px)`, opacity: 0 },
      ], { duration: 440, easing: 'ease-out' });
      destello.onfinish = () => chispa.remove();
    }
  });
});
reducirMovimiento.addEventListener('change', actualizar);
