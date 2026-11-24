export function moverFechaTurno(fecha, diaMes, direccion = 1) {
  const dia = new Date(fecha);
  if (diaMes === null) {
    dia.setUTCDate(dia.getUTCDate() + 7 * direccion);
  } else {
    dia.setUTCMonth(dia.getUTCMonth() + direccion, 1);
    const fin = new Date(dia);
    fin.setUTCMonth(fin.getUTCMonth() + 1, 0);
    dia.setUTCDate(Math.min(diaMes, fin.getUTCDate()));
  }
  return dia.toISOString().slice(0, 10);
}

function siguienteMiembro(participantes, posicion, activos) {
  for (let paso = 0; paso < participantes.length; paso += 1) {
    const indice = (posicion + paso) % participantes.length;
    const miembro = activos.get(participantes[indice]);
    if (miembro) return { miembro, siguiente: (indice + 1) % participantes.length };
  }
  return null;
}

// Plan puro: decide fechas y responsables sin consultar ni modificar la base de datos.
export function planificarTurno(fecha, posicion, participantes, diaMes, activos, hoy) {
  const tareas = [];
  let siguiente = siguienteMiembro(participantes, posicion, activos);
  while (siguiente && moverFechaTurno(fecha, diaMes, -1) < hoy && tareas.length < 52) {
    tareas.push({ fecha, miembro: siguiente.miembro });
    fecha = moverFechaTurno(fecha, diaMes);
    posicion = siguiente.siguiente;
    siguiente = siguienteMiembro(participantes, posicion, activos);
  }
  return { tareas, fecha, posicion, siguiente };
}

export function planificarCambioTurno(anteriores, responsable, mismoResponsable, limite, frecuencia) {
  let participantes = [responsable];
  if (mismoResponsable && anteriores?.includes(responsable)) {
    const indice = anteriores.indexOf(responsable);
    participantes = [...anteriores.slice(indice), ...anteriores.slice(0, indice)];
  }
  const recurrente = frecuencia !== 'puntual';
  const diaMes = frecuencia === 'mensual' ? Number(limite.slice(-2)) : null;
  return { participantes, recurrente, diaMes,
    siguienteFecha: recurrente ? moverFechaTurno(limite, diaMes) : null,
    siguientePosicion: 1 % participantes.length };
}

export const politicaTurnos = { moverFechaTurno, planificarCambioTurno };

