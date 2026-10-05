// Capa API: recibe peticiones HTTP y devuelve respuestas al cliente.
// De momento probamos el servidor; después lo conectaremos con la lógica.

import express from 'express';
import { obtenerEstadoAplicacion } from './logica.js';

// Creamos la aplicación Express.
const app = express();

// Usamos el puerto configurado en el entorno o, si no existe, el 3000.
const puerto = process.env.PORT || 3000;

// Permite leer los datos JSON recibidos en las peticiones.
app.use(express.json());

// Ruta de prueba para comprobar que el servidor responde.
// req representa la petición recibida y res la respuesta que enviamos.
app.get('/api/estado', (req, res) => {
  const estado = obtenerEstadoAplicacion();
  res.json(estado);
});

// Arrancamos el servidor para que escuche peticiones en ese puerto.
app.listen(puerto, () => {
  console.log(`Servidor en http://localhost:${puerto}`);
});