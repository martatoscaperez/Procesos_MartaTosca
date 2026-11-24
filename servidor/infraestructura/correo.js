import nodemailer from 'nodemailer';

// El origen se configura: nunca se construye a partir del Host de la petición.
export function crearCorreoConfirmacion({ entorno = process.env, transporte } = {}) {
  const pruebas = entorno.NODE_ENV === 'test';
  let origen;
  try {
    origen = new URL(entorno.APP_URL);
    if (origen.username || origen.password || origen.search || origen.hash ||
        origen.pathname !== '/' ||
        (origen.protocol !== 'https:' &&
         !(entorno.NODE_ENV !== 'production' && origen.protocol === 'http:'))) {
      throw new Error();
    }
  } catch {
    throw new Error('Configura APP_URL con el origen público de la aplicación.');
  }

  if (!transporte) {
    if (pruebas) {
      // Solo las pruebas usan un transporte que no envía correos reales.
      transporte = nodemailer.createTransport({ jsonTransport: true });
    } else {
      const puerto = Number(entorno.SMTP_PORT || 587);
      if (!entorno.SMTP_HOST || !entorno.SMTP_USER || !entorno.SMTP_PASS ||
          !entorno.MAIL_FROM || ![465, 587].includes(puerto)) {
        throw new Error('Falta configurar el servicio de correo SMTP.');
      }
      transporte = nodemailer.createTransport({
        host: entorno.SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        requireTLS: puerto === 587,
        auth: { user: entorno.SMTP_USER, pass: entorno.SMTP_PASS },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        disableFileAccess: true,
        disableUrlAccess: true
      });
    }
  }

  return {
    async enviarConfirmacion(email, token) {
      // El fragmento no se envía al servidor web ni a sus logs de acceso.
      const enlace = new URL('/confirmar.html', origen);
      enlace.hash = new URLSearchParams({ email, token }).toString();
      const resultado = await transporte.sendMail({
        from: entorno.MAIL_FROM || 'pruebas@example.com',
        to: { address: email },
        subject: 'Confirma tu cuenta — Proyecto de Procesos',
        text: `Confirma tu cuenta abriendo este enlace:\n\n${enlace.href}\n\n` +
          'El enlace caduca en una hora y solo puede utilizarse una vez.\n' +
          'Si no has solicitado esta cuenta, ignora este mensaje.'
      });
      if (resultado.rejected?.length) {
        throw new Error('El servidor de correo rechazó el destinatario.');
      }
    }
  };
}
