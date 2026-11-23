// Los empates comparten puesto y el siguiente grupo ocupa el puesto consecutivo.
export function clasificarRanking(miembros) {
  const ordenados = [...miembros].sort((a, b) => b.puntos - a.puntos
    || a.nombre.localeCompare(b.nombre, 'es') || String(a.id).localeCompare(String(b.id)));
  const cantidades = new Map();
  for (const miembro of ordenados) cantidades.set(miembro.puntos, (cantidades.get(miembro.puntos) ?? 0) + 1);
  let posicion = 0;
  let anterior;
  return ordenados.map(miembro => {
    if (posicion === 0 || miembro.puntos !== anterior) ++posicion;
    anterior = miembro.puntos;
    return { ...miembro, posicion, empatado: cantidades.get(miembro.puntos) > 1 };
  });
}
