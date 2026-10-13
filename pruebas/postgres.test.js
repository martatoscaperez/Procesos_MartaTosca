import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crearConexion } from '../servidor/conexion.js';
import {
  crearRepositorioUsuariosPostgres
} from '../servidor/datos-postgres.js';
import { crearServicioUsuarios } from '../servidor/logica.js';

test(
  'PostgreSQL guarda usuarios, confirma cuentas y rechaza duplicados',
  { skip: !process.env.DATABASE_URL },
  async () => {
    const conexion = crearConexion();
    let cliente;

    try {
      cliente = await conexion.connect();
      await cliente.query('BEGIN');

      // La tabla temporal solo existe en esta conexión.
      // Oculta la tabla real para las consultas de esta prueba.
      const esquema = await readFile(
        new URL('../servidor/esquema.sql', import.meta.url),
        'utf8'
      );

      const esquemaTemporal = esquema.replace(
        /CREATE TABLE IF NOT EXISTS usuarios/i,
        'CREATE TEMP TABLE usuarios'
      );

      assert.notEqual(esquemaTemporal, esquema);
      await cliente.query(esquemaTemporal);

      const repositorio = crearRepositorioUsuariosPostgres(cliente);
      const servicio = crearServicioUsuarios(repositorio);

      const creado = await servicio.agregarUsuario(
        ' POSTGRES@example.com ',
        'Prueba PostgreSQL',
        'clave-ficticia'
      );

      assert.deepEqual(creado, {
        email: 'postgres@example.com',
        nombre: 'Prueba PostgreSQL',
        rol: 'usuario',
        estado: 'pendiente'
      });

      const interno = await repositorio.buscarPorEmail(
        'postgres@example.com'
      );

      assert.equal(typeof interno.claveHash, 'string');
      assert.notEqual(interno.claveHash, 'clave-ficticia');

      assert.equal(
        await repositorio.buscarPorEmail('nadie@example.com'),
        null
      );

      // Comprobamos la restricción de duplicados de PostgreSQL.
      // El savepoint permite continuar tras el error esperado.
      await cliente.query('SAVEPOINT duplicado');

      await assert.rejects(
        () => repositorio.insertar(interno),
        /Ya existe un usuario con ese email/
      );

      await cliente.query('ROLLBACK TO SAVEPOINT duplicado');

      // Comprobamos la conversión de BIGINT y la actualización.
      const token = await servicio.generarConfirmacion(
        'postgres@example.com'
      );

      const pendiente = await repositorio.buscarPorEmail(
        'postgres@example.com'
      );

      assert.equal(typeof pendiente.confirmacionCaduca, 'number');
      assert.ok(pendiente.confirmacionCaduca > Date.now());

      await servicio.confirmarUsuario('postgres@example.com', token);

      const confirmado = await repositorio.buscarPorEmail(
        'postgres@example.com'
      );

      assert.equal(confirmado.estado, 'activo');
      assert.equal(Object.hasOwn(confirmado, 'confirmacionHash'), false);
      assert.equal(Object.hasOwn(confirmado, 'confirmacionCaduca'), false);

      const usuario = await servicio.iniciarSesion(
        'postgres@example.com',
        'clave-ficticia'
      );

      assert.equal(usuario.estado, 'activo');

      // Otro repositorio recupera los datos guardados en la tabla.
      const otroRepositorio = crearRepositorioUsuariosPostgres(cliente);
      const listado = await otroRepositorio.listar();

      assert.equal(listado.length, 1);
      assert.equal(listado[0].email, 'postgres@example.com');

      await servicio.eliminarUsuario('postgres@example.com');

      assert.equal(
        await servicio.usuarioActivo('postgres@example.com'),
        false
      );

      await assert.rejects(
        () => servicio.iniciarSesion(
          'postgres@example.com',
          'clave-ficticia'
        ),
        /Email o contraseña incorrectos/
      );
    } finally {
      try {
        if (cliente) {
          // Deshace los datos y la creación de la tabla temporal.
          await cliente.query('ROLLBACK');
        }
      } finally {
        if (cliente) {
          cliente.release();
        }

        await conexion.end();
      }
    }
  }
);