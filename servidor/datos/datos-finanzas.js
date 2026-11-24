// Ejecuta una operación sobre los movimientos de un piso de forma atómica.
// La validación y los cálculos los aporta el servicio, no este repositorio.
export function crearRepositorioFinanzasMemoria() {
  const memoria = new Map();
  return {
    async operar(id, accion, guardar = true) {
      const registros = structuredClone(memoria.get(id) ?? []);
      const resultado = await accion(registros);
      if (guardar) memoria.set(id, registros);
      return resultado;
    }
  };
}

export function crearRepositorioFinanzasPostgres(conexion) {
  return {
    async operar(id, accion, guardar = true) {
      const cliente = await conexion.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query('SELECT id FROM public.hogares WHERE id=$1 FOR UPDATE', [id]);
        const { rows } = await cliente.query('SELECT datos FROM public.movimientos_hogar WHERE hogar_id=$1 ORDER BY creado_en,id', [id]);
        const registros = rows.map(fila => fila.datos);
        const resultado = await accion(registros);
        if (guardar) {
          await cliente.query('DELETE FROM public.movimientos_hogar WHERE hogar_id=$1', [id]);
          for (const registro of registros) {
            await cliente.query('INSERT INTO public.movimientos_hogar (id,hogar_id,datos) VALUES ($1,$2,$3)', [registro.id, id, registro]);
          }
        }
        await cliente.query('COMMIT');
        return resultado;
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally { cliente.release(); }
    }
  };
}
