// Capa API: recibe peticiones HTTP, llama a la lógica
// y devuelve respuestas al cliente.
import express from 'express';
import {
  obtenerEstadoAplicacion,
  crearServicioUsuarios
} from './logica.js';
import { fileURLToPath } from 'node:url';

// Creamos la aplicación Express.
const app = express();

// Un único servicio conserva los usuarios entre peticiones.
// Al reiniciar el servidor, los datos en memoria se pierden.
const servicioUsuarios = crearServicioUsuarios();

// Usamos el puerto del entorno o el 3000 por defecto.
const puerto = process.env.PORT || 3000;

// Permite leer el cuerpo JSON de las peticiones.
app.use(express.json());

// Localizamos la carpeta cliente tomando como referencia este archivo.
const carpetaCliente = fileURLToPath(
  new URL('../cliente/', import.meta.url)
);

// Servimos sus archivos. En la ruta "/" se mostrará index.html.
app.use(express.static(carpetaCliente));

// GET: consulta el estado de la aplicación.
app.get('/api/estado', (req, res) => {
  const estado = obtenerEstadoAplicacion();
  res.json(estado);
});

// POST: crea un usuario con el email recibido.
app.post('/api/usuarios', (req, res) => {
  try {
    const email = req.body?.email;
    const usuario = servicioUsuarios.agregarUsuario(email);

    // 201 indica que se ha creado un recurso.
    res.status(201).json(usuario);
  } catch (error) {
    // Manejo provisional de los errores del alta.
    res.status(400).json({ error: error.message });
  }
});

// GET: obtiene el listado a través de la lógica.
// Pendiente: restringir esta operación al administrador.
app.get('/api/usuarios', (req, res) => {
  const usuarios = servicioUsuarios.obtenerUsuarios();
  res.json(usuarios);
});
// Consulta si una cuenta está activa.
// Pendiente: restringir esta operación al administrador.
app.get('/api/usuarios/:email/activo', (req, res) => {
  try {
    // req.params recoge el email incluido en la URL.
    const email = req.params.email;
    const activo = servicioUsuarios.usuarioActivo(email);

    res.json({ activo });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Marca la cuenta como eliminada a través de la lógica.
// Pendiente: permitir solo al administrador o al dueño de la cuenta.
app.delete('/api/usuarios/:email', (req, res) => {
  try {
    const email = req.params.email;
    const usuario = servicioUsuarios.eliminarUsuario(email);

    res.json(usuario);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
// Arrancamos el servidor para escuchar peticiones.
app.listen(puerto, () => {
  console.log(`Servidor en http://localhost:${puerto}`);
});