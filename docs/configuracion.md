# Configuración y ejecución de HogarDu

Esta guía reúne las instrucciones técnicas que complementan el [inicio rápido del README](../README.md). Para conocer las funciones y las decisiones, consulta el [índice de documentación](index.md).

## Requisitos y primer arranque

- Node.js 24 y npm.
- Una base PostgreSQL accesible, local o alojada en Neon.
- Variables de entorno en `.env`, creado a partir de [`.env.example`](../.env.example).

```powershell
npm.cmd ci
Copy-Item .env.example .env
```

Completar la configuración antes de arrancar. En una base nueva, ejecutar [esquema.sql](../servidor/datos/esquema.sql) en PostgreSQL; en Neon puede hacerse desde SQL Editor. Después, preparar las tablas del piso:

```powershell
npm.cmd run migrar-hogares
npm.cmd start
```

Abrir [localhost:3000](http://localhost:3000/). Para detener el servidor, pulsar `Ctrl + C` en su terminal. Si el puerto está ocupado, cerrar el proceso anterior antes de volver a arrancar. En Linux y macOS se utiliza `npm` en lugar de `npm.cmd`.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de PostgreSQL. |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión. Debe ser privado y suficientemente aleatorio. |
| `NODE_ENV` | `development` en local; `production` en Cloud Run. Las pruebas HTTP usan `test`. |
| `PORT` | Puerto opcional; por defecto 3000. Cloud Run lo proporciona. |
| `ALLOWED_DOMAINS` | Dominios admitidos en el registro, separados por comas. |
| `APP_URL` | Origen público de la app, sin rutas. En local, `http://localhost:3000`; en producción, el origen HTTPS de Cloud Run. |
| `SMTP_HOST`, `SMTP_PORT` | Servidor y puerto del proveedor de correo. |
| `SMTP_USER`, `SMTP_PASS` | Credenciales SMTP del proveedor. |
| `MAIL_FROM` | Remitente verificado para enviar confirmaciones. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Credenciales del cliente OAuth de Google. |

Los valores reales no se publican en Git. `.env.example` contiene los nombres de las variables, no credenciales de evaluación.

## PostgreSQL y migraciones

Los archivos SQL están en [servidor/datos](../servidor/datos/). La base nueva se prepara con `esquema.sql` y el comando `migrar-hogares`. La preparación de datos al arrancar contempla la columna de foto personal.

Para una base antigua que aún no admita identidad Google:

```powershell
npm.cmd run migrar-google
```

La migración añade el identificador Google y permite cuentas OAuth sin contraseña local. `migrar-hogares` añade las tablas de convivencia. Ambos comandos leen `DATABASE_URL` y están diseñados para poder repetirse sin eliminar los datos existentes.

No se debe volver a inicializar una base compartida con datos de uso real para preparar una prueba. Las pruebas de integración utilizan tablas temporales y revierten sus cambios.

## Correo de confirmación

Configurar `APP_URL`, las variables SMTP y `MAIL_FROM`. El transporte admite el puerto 587 con STARTTLS obligatorio o 465 con TLS desde el inicio. La configuración empleada en el proyecto utiliza Brevo; su clave SMTP es distinta de una clave API.

Sin configuración de correo válida, el registro y el reenvío devuelven un error de disponibilidad; el acceso de cuentas ya existentes sigue disponible. Si el envío falla después de crear una cuenta pendiente, esta no se activa y puede solicitarse otro enlace acreditando su contraseña.

La interfaz de confirmación recibe el enlace, envía el código al servidor y elimina el fragmento del historial. El reenvío se limita por minuto e IP en la instancia actual; ese límite en memoria no es un límite global distribuido.

Para verificar el proveedor real, registrar una cuenta de un dominio permitido, comprobar recepción —incluido spam—, confirmar, entrar y rechazar la reutilización del código. Las pruebas automáticas de correo usan transportes simulados.

## Google OAuth

Configurar un cliente de tipo «Aplicación web», con los ámbitos `openid`, `email` y `profile`, y autorizar las cuentas de prueba si el proveedor está en modo de pruebas.

URI de redirección de producción:

```text
https://procesos-martatosca-569228981488.europe-west1.run.app/api/auth/google/callback
```

Para desarrollo:

```text
http://localhost:3000/api/auth/google/callback
```

Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `APP_URL` en el entorno correspondiente. Si falta configuración válida, el botón se oculta y el login local sigue disponible.

Una cuenta local existente requiere vinculación explícita desde una sesión identificada; no basta con que Google devuelva el mismo correo. Para probar el consentimiento real se recomienda un navegador externo, ya que Google puede rechazar navegadores incrustados. Si la instancia se reinicia durante el recorrido OAuth, hay que comenzar el acceso de nuevo.

## Administrador y cuentas de prueba

Para inicializar una cuenta administradora global, configurar `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_CLAVE` y ejecutar:

```powershell
npm.cmd run crear-admin
```

Si esa cuenta ya existe como administradora activa, el script conserva su contraseña. Si el correo pertenece a otra cuenta, rechaza la operación. Este rol global es independiente del rol de administrador dentro de cada piso.

La cuenta de prueba local se habilita solo en desarrollo o pruebas con `CREAR_USUARIO_PRUEBA=true`, `USUARIO_PRUEBA_EMAIL` y `USUARIO_PRUEBA_CLAVE`. No se configura esta creación automática en producción. La cuenta ficticia de administrador de las pruebas HTTP se crea solo en memoria.

Los datos de acceso para una evaluación se comparten por un canal privado, no en el README ni en esta guía.

## Pruebas y comprobación publicada

```powershell
npm.cmd test
```

Para incluir PostgreSQL con las variables de `.env`:

```powershell
node --env-file-if-exists=.env --test
```

Sin `DATABASE_URL`, las integraciones que requieren PostgreSQL se omiten. GitHub Actions prepara una base temporal para ejecutarlas. Los casos HTTP arrancan un servidor independiente con datos ficticios; no necesitan el servidor habitual en el puerto 3000.

El [proceso de validación publicado](procesos.md#reproducir-la-comprobación-publicada) explica cómo ejecutar `scripts/comprobar-despliegue.js` con dos cuentas y un piso dedicado. Sus credenciales se configuran en el entorno, no en el código.

## Despliegue en Google Cloud

La publicación principal está en [Cloud Run](https://procesos-martatosca-569228981488.europe-west1.run.app/).

| Ajuste | Configuración del proyecto |
| --- | --- |
| Proyecto | `proyecto-de-procesos-513615` |
| Servicio | `procesos-martatosca` |
| Región | `europe-west1` |
| Fuente | Rama `main` de este repositorio. |
| Construcción | Buildpacks de Node.js, directorio raíz, sin función objetivo ni entrypoint personalizado. |
| Arranque | `npm start`; Cloud Run asigna `PORT`. |
| Acceso | Servicio público con login y permisos aplicados por la app. |
| Escalado | Mínimo 0 y máximo 1 instancia. |

Cloud Build y Artifact Registry construyen y publican los cambios de `main`. La configuración del disparador está en Google Cloud. GitHub Actions ejecuta las pruebas por separado: un CI correcto no acredita por sí solo que el despliegue haya terminado.

Configurar las variables de aplicación y proveedores en Cloud Run. PostgreSQL sigue alojado en Neon; no hace falta crear una base Cloud SQL por utilizar Cloud Run. El archivo `render.yaml` conserva la configuración anterior de Render, que no es la publicación principal.

Con mínimo 0 puede haber un primer acceso más lento. Las sesiones se guardan en memoria y un reinicio puede requerir volver a entrar. El [documento de arquitectura](arquitectura.md#avisos-y-límites-operativos) explica este límite y el alcance de SSE entre procesos.
