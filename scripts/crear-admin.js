import { crearConexion } from '../servidor/conexion.js';
import {
  crearRepositorioUsuariosPostgres
} from '../servidor/datos-postgres.js';
import { crearServicioUsuarios } from '../servidor/logica.js';

// Lee las credenciales desde el entorno.
const email = process.env.ADMIN_EMAIL;
const nombre = process.env.ADMIN_NOMBRE;
const clave = process.env.ADMIN_CLAVE;

if (
  typeof email !== 'string' ||
  email.trim() === '' ||
  typeof nombre !== 'string' ||
  nombre.trim() === '' ||
  typeof clave !== 'string' ||
  clave.length === 0
) {
  throw new Error(
    'Configura ADMIN_EMAIL, ADMIN_NOMBRE y ADMIN_CLAVE.'
  );
}

const conexion = crearConexion();
let cliente;
let transaccionAbierta = false;

try {
  cliente = await conexion.connect();

  // Creamos y promovemos la cuenta como una única operación.
  await cliente.query('BEGIN');
  transaccionAbierta = true;

  const repositorio = crearRepositorioUsuariosPostgres(cliente);
  const servicio = crearServicioUsuarios(repositorio);
  const emailNormalizado = email.trim().toLowerCase();

  const existente = await repositorio.buscarPorEmail(emailNormalizado);

  if (existente) {
    if (
      existente.rol !== 'administrador' ||
      existente.estado !== 'activo'
    ) {
      throw new Error(
        'Ese email ya pertenece a otra cuenta. Usa un email diferente.'
      );
    }

    console.log(
      'El administrador ya existe. Se conserva su contraseña.'
    );
  } else {
    // Reutilizamos las validaciones y el hash de la capa lógica.
    await servicio.agregarUsuario(emailNormalizado, nombre, clave);

    const usuario = await repositorio.buscarPorEmail(emailNormalizado);

    // La inicialización crea una cuenta administrativa activa.
    usuario.rol = 'administrador';
    usuario.estado = 'activo';

    await repositorio.guardar(usuario);

    console.log('Administrador creado.');
  }

  await cliente.query('COMMIT');
  transaccionAbierta = false;
} catch (error) {
  if (cliente && transaccionAbierta) {
    await cliente.query('ROLLBACK');
  }

  throw error;
} finally {
  if (cliente) {
    cliente.release();
  }

  await conexion.end();
}