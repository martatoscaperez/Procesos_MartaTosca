// Capa API: recibe peticiones HTTP, llama a la lógica
// y devuelve respuestas al cliente.
import express from 'express';
import session from 'express-session';
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

// El secreto debe estar configurado antes de arrancar.
const secretoSesion = process.env.SESSION_SECRET;

if (!secretoSesion || secretoSesion.trim() === '') {
  throw new Error('Falta configurar SESSION_SECRET en .env.');
}

// Conserva la sesión entre las peticiones del navegador.
// Por ahora, las sesiones se guardan en memoria.
app.use(session({
  secret: secretoSesion,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60
  }
}));

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

// POST: recibe los datos del registro y delega las reglas en la lógica.
app.post('/api/usuarios', async (req, res) => {
  try {
    const { email, nombre, clave } = req.body ?? {};

    // Esperamos a que la lógica calcule el hash y guarde la cuenta.
    const usuario = await servicioUsuarios.agregarUsuario(
      email,
      nombre,
      clave
    );

    // La lógica devuelve datos públicos, sin contraseña ni hash.
    res.status(201).json(usuario);
  } catch (error) {
    // Manejo provisional de errores; lo afinaremos después.
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
// POST: comprueba las credenciales y crea una sesión.
app.post('/api/login', async (req, res) => {
  let usuario;

  try {
    const { email, clave } = req.body ?? {};
    usuario = await servicioUsuarios.iniciarSesion(email, clave);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }

  // Creamos un identificador nuevo para la sesión al iniciar sesión.
  req.session.regenerate((error) => {
    if (error) {
      return res.status(500).json({
        error: 'No se pudo crear la sesión.'
      });
    }

    // Guardamos únicamente el email, nunca la contraseña ni su hash.
    req.session.email = usuario.email;

    // Guardamos la sesión antes de responder al navegador.
    req.session.save((error) => {
      if (error) {
        return res.status(500).json({
          error: 'No se pudo guardar la sesión.'
        });
      }

      res.json(usuario);
    });
  });
});
// GET: confirma una cuenta mediante el código recibido en el enlace.
app.get('/api/confirmar', (req, res) => {
  // Evitamos almacenar en caché la respuesta de confirmación.
  res.set('Cache-Control', 'no-store');
  res.set('Referrer-Policy', 'no-referrer');

  try {
    const { email, token } = req.query;

    const usuario = servicioUsuarios.confirmarUsuario(email, token);

    res.type('text').send(
      'Cuenta confirmada. Vuelve a la página principal para iniciar sesión.'
    );
  } catch (error) {
    res.status(400).type('text').send(error.message);
  }
});
// GET: consulta el usuario de la sesión actual.
app.get('/api/sesion', (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (!req.session.email) {
    return res.status(401).json({
      error: 'Debes iniciar sesión.'
    });
  }

  let usuario;

  try {
    usuario = servicioUsuarios.obtenerUsuarioActivo(req.session.email);
  } catch (error) {
    // Invalidamos la sesión si la cuenta ya no está activa.
    return req.session.destroy((errorSesion) => {
      if (errorSesion) {
        return res.status(500).json({
          error: 'No se pudo invalidar la sesión.'
        });
      }

      res.clearCookie('connect.sid', { path: '/' });

      res.status(401).json({
        error: 'La sesión ya no es válida. Inicia sesión de nuevo.'
      });
    });
  }

  res.json(usuario);
});
// POST: elimina la sesión del servidor y la cookie del navegador.
app.post('/api/logout', (req, res) => {
  res.set('Cache-Control', 'no-store');

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        error: 'No se pudo cerrar la sesión.'
      });
    }

    res.clearCookie('connect.sid', { path: '/' });

    res.json({
      mensaje: 'Sesión cerrada.'
    });
  });
});
// Crea una cuenta activa de prueba solo en desarrollo local.
if (
  process.env.NODE_ENV === 'development' &&
  process.env.CREAR_USUARIO_PRUEBA === 'true'
) {
  const email = process.env.USUARIO_PRUEBA_EMAIL;
  const clave = process.env.USUARIO_PRUEBA_CLAVE;

  await servicioUsuarios.agregarUsuario(
    email,
    'Usuario de prueba',
    clave
  );

  const token = servicioUsuarios.generarConfirmacion(email);
  servicioUsuarios.confirmarUsuario(email, token);

  console.log('Cuenta de prueba preparada.');
}
// Arrancamos el servidor para escuchar peticiones.
const servidor = app.listen(puerto, () => {
  const puertoAsignado = servidor.address().port;
  console.log(`Servidor en http://localhost:${puertoAsignado}`);
});