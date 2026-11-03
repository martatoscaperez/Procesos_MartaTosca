# Proyecto de Procesos

Proyecto individual de Procesos de Ingeniería del Software,
curso 2026–2027.

Base de una aplicación web con gestión de usuarios y autenticación.
La temática y el nombre definitivo se elegirán después de completar el hito 4.
Hasta entonces, el desarrollo se centra en las funcionalidades comunes:
registro, sesiones, roles, permisos, persistencia, confirmación por correo
y acceso mediante OAuth.

El nombre provisional es «Proyecto de Procesos». Los documentos anteriores
pueden conservar el nombre inicial «Piso compartido».

Esta entrega cubre los hitos 1, 2 y 3: arquitectura por capas,
gestión de usuarios, frontend, sesiones, rutas protegidas,
persistencia en PostgreSQL, roles y registro de actividad.

Aplicación publicada:
https://procesos-martatosca-569228981488.europe-west1.run.app

Repositorio:
https://github.com/martatoscaperez/Procesos_MartaTosca

## Tecnologías y justificación

- Node.js 24 y JavaScript: permiten desarrollar cliente y servidor
  con el mismo lenguaje.
- Express: gestiona las rutas HTTP y sirve el frontend desde el backend.
- bcrypt: permite almacenar las contraseñas mediante hashes seguros.
- express-session: conserva la identidad del usuario entre peticiones.
- PostgreSQL: proporciona almacenamiento persistente y restricciones
  para evitar emails duplicados.
- pg: conecta el servidor con PostgreSQL mediante consultas parametrizadas.
- Neon: aloja la base de datos PostgreSQL.
- Node Test Runner: ejecuta pruebas automatizadas con un comando.
- GitHub Actions: ejecuta las pruebas en pull requests y cambios de main.
- Google Cloud Run: aloja el servidor y sirve el frontend.
- Cloud Build y Artifact Registry: construyen y almacenan la imagen
  utilizada para desplegar los cambios de main en Cloud Run.

## Arquitectura

El backend está separado en tres capas:

- API: `servidor/api.js` recibe peticiones, aplica controles de acceso
  y devuelve respuestas HTTP.
- Lógica: `servidor/logica.js` contiene las reglas de gestión de usuarios.
- Datos: `servidor/datos-postgres.js` consulta y guarda usuarios
  en PostgreSQL.

Módulos auxiliares:

- `servidor/conexion.js`: crea las conexiones a PostgreSQL.
- `servidor/esquema.sql`: define la tabla de usuarios.
- `servidor/datos.js`: repositorio en memoria utilizado en las pruebas.
- `servidor/actividad.js`: registra eventos relevantes.
- `scripts/crear-admin.js`: inicializa el primer administrador.

El recorrido de las peticiones es API → lógica → datos.

El frontend también separa sus responsabilidades:

- `cliente/index.html`, `cliente/estilos.css` y `cliente/controlador.js`:
  interfaz y presentación.
- `cliente/comunicacion/rest.js`: comunicación con la API.

El backend sirve el frontend desde el mismo origen.
El navegador no accede directamente a la base de datos.
Las consultas SQL están en la capa de datos.

## Funcionalidades

- Registro local con email, nombre y contraseña.
- Almacenamiento de contraseñas mediante bcrypt.
- Inicio de sesión de cuentas activas.
- Mantenimiento de la sesión entre recargas de página.
- Cierre de sesión que invalida la sesión del servidor y elimina la cookie.
- Listado de usuarios y consulta de estado reservados al administrador.
- Eliminación de la propia cuenta por un usuario normal.
- Eliminación de cualquier cuenta por el administrador.
- Persistencia de usuarios después de reiniciar el servidor.
- Registro de actividad mediante logs.

Una cuenta registrada comienza en estado `pendiente`.
Las cuentas eliminadas no pueden iniciar sesión.

El registro incorpora el envío de un enlace de confirmación mediante SMTP.
El flujo real de registro, recepción, activación y login se ha comprobado
en Cloud Run con Brevo. El primer mensaje llegó a spam.

## Confirmación por correo (hito 4)

1. El registro crea una cuenta pendiente y genera un token aleatorio.
2. Se guarda únicamente el hash del token, con caducidad de una hora.
3. El servicio SMTP envía un enlace a `/confirmar.html`. El usuario pulsa
   «Confirmar cuenta» para activar la cuenta y luego inicia sesión.
4. La confirmación consume el token. Un reenvío invalida el enlace anterior.

El token viaja en el fragmento del enlace y se entrega a la API por POST,
para que no aparezca en los logs HTTP de las peticiones de confirmación.
La página elimina el fragmento del historial y no carga recursos externos.
La ruta GET anterior se conserva por compatibilidad; los correos nuevos
utilizan el flujo POST.

Si falla SMTP después de crear la cuenta, la API devuelve `correoEnviado=false`.
La interfaz explica cómo reenviar el mensaje desde el formulario de login,
introduciendo el email y la contraseña de la cuenta pendiente.
El reenvío limita a una solicitud por minuto e IP en la instancia actual.
Este límite en memoria se reinicia al sustituir la instancia; no es un límite
global del proveedor. Un envío aceptado por SMTP no garantiza entrega en la
bandeja de entrada: revisar también spam y los eventos del proveedor.

Configurar en `.env` y en Cloud Run:

| Variable | Contenido |
| --- | --- |
| `APP_URL` | Origen público HTTPS, sin rutas; en local se admite `http://localhost:3000` |
| `SMTP_HOST` | Servidor SMTP del proveedor |
| `SMTP_PORT` | `587` con STARTTLS obligatorio o `465` con TLS desde el inicio |
| `SMTP_USER` | Usuario SMTP facilitado por el proveedor |
| `SMTP_PASS` | Contraseña o clave SMTP del proveedor |
| `MAIL_FROM` | Dirección de remitente verificada en el proveedor |

En producción, `APP_URL` es
`https://procesos-martatosca-569228981488.europe-west1.run.app`.
Sin configuración válida, el registro y el reenvío devuelven 503 antes de
crear una cuenta; el login de las cuentas existentes sigue disponible.
Los errores internos SMTP no se devuelven al navegador ni se escriben en logs.
No se deben guardar estas credenciales en Git ni adjuntarlas en capturas.

Nodemailer permite cambiar de proveedor mediante estas variables:
[documentación SMTP](https://nodemailer.com/smtp).
Como opción de configuración puede usarse
[Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP):
host `smtp-relay.brevo.com`, puerto `587`, login indicado en su panel y
una clave SMTP, distinta de una clave API. Primero verificar el remitente.

Antes de integrar y desplegar, preparar las variables del proveedor.
Después registrar una cuenta real de un dominio permitido, confirmar que
recibe el correo, activarla, comprobar login y rechazar el enlace reutilizado.
La comprobación real ya se ha realizado con una cuenta Gmail, añadiendo
`gmail.com` a `ALLOWED_DOMAINS` en Cloud Run. Las pruebas automatizadas utilizan
transportes simulados y no envían correos a terceros.

## Acceso con Google (hito 4)

La implementación OAuth está preparada y pendiente de configurar y verificar
con credenciales reales antes de publicar esta versión.
Se usa la biblioteca oficial `google-auth-library` y el flujo de código de
autorización con PKCE S256, state aleatorio, nonce y caducidad de 10 minutos.
La biblioteca verifica firma, emisor, audiencia y caducidad del ID token;
la aplicación comprueba el nonce y exige un email verificado y permitido.
Solo se solicitan `openid`, `email` y `profile`; no se guardan tokens Google.

Google identifica la cuenta mediante `sub`, no por la coincidencia del email.
Una cuenta nueva recibe rol `usuario` y estado `activo`, sin contraseña local.
La baja de la cuenta impide futuros accesos Google.
Si ya existe una cuenta local, debe estar activa y el usuario tiene que entrar
primero con contraseña y pulsar «Vincular Google a mi cuenta», eligiendo el
mismo email. Se conservan contraseña y rol; no se activa una cuenta pendiente
ni se vincula automáticamente una identidad con el mismo email.

Preparación de la base existente, antes de desplegar el código:

```powershell
npm.cmd run migrar-google
```

El script ejecuta `servidor/migracion-google.sql` sobre `DATABASE_URL` de `.env`.
Añade el identificador Google único y permite contraseñas nulas en cuentas
creadas por OAuth. No elimina cuentas ni cambia contraseñas, roles o estados.
Se puede repetir. Una base nueva usa directamente `servidor/esquema.sql`.

En Google Auth Platform, configurar un cliente OAuth de tipo «Aplicación web»:

- Nombre de la aplicación: `Proyecto de Procesos`.
- Ámbitos: `openid`, `email` y `profile`.
- En modo pruebas, añadir las cuentas que vayan a probar el acceso.
- URI de redirección autorizada de producción:
  `https://procesos-martatosca-569228981488.europe-west1.run.app/api/auth/google/callback`.
- Para desarrollo, añadir también
  `http://localhost:3000/api/auth/google/callback`.

Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `APP_URL` en `.env`
y en las variables de Cloud Run. El secreto solo se utiliza en el backend.
El botón se oculta si falta configuración válida; el login local sigue disponible.
Si la instancia se reinicia durante la redirección, el intento en sesión se
pierde y es necesario volver a empezar el acceso con Google.

Antes de marcar OAuth como completado, comprobar en Chrome o un navegador
externo: vinculación de la cuenta local, login posterior con Google,
creación de una cuenta Google nueva permitida y rechazo de una cuenta eliminada.
Google puede rechazar el acceso desde navegadores incrustados en aplicaciones.

Referencias: [OAuth para servidores web](https://developers.google.com/identity/protocols/oauth2/web-server)
y [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## Ejecutar en local

Requisitos:

- Node.js 24.
- npm.
- Una base de datos PostgreSQL, por ejemplo alojada en Neon.

Pasos:

1. Clonar el repositorio y abrir una terminal en su carpeta.

2. Instalar las dependencias:

   ```powershell
   npm.cmd ci
   ```

3. Copiar `.env.example` a `.env`:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Configurar `DATABASE_URL`, `SESSION_SECRET` y
   `NODE_ENV=development` en `.env`.

5. Ejecutar el contenido de `servidor/esquema.sql` en PostgreSQL.
   En Neon puede utilizarse el SQL Editor.

6. Arrancar el servidor:

   ```powershell
   npm.cmd start
   ```

7. Abrir http://localhost:3000.

Para detener el servidor, pulsar Ctrl+C en su terminal.

`.env` está excluido de Git y no debe publicarse.

## Variables de entorno

El archivo `.env.example` documenta los nombres sin valores reales.

Variables de la aplicación:

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `SESSION_SECRET`: secreto utilizado para firmar la cookie de sesión.
- `NODE_ENV`: `development` en local y `production` en Cloud Run.
  Las pruebas HTTP utilizan `test`.
- `PORT`: puerto opcional; por defecto, 3000.
  Cloud Run lo proporciona automáticamente.
- `ALLOWED_DOMAINS`: dominios admitidos para el registro, separados por
  comas; por ejemplo, `uclm.es,alu.uclm.es`.

Variables opcionales de la cuenta de prueba local:

- `CREAR_USUARIO_PRUEBA`
- `USUARIO_PRUEBA_EMAIL`
- `USUARIO_PRUEBA_CLAVE`

Variables del script de inicialización del administrador:

- `ADMIN_EMAIL`
- `ADMIN_NOMBRE`
- `ADMIN_CLAVE`

Los valores reales se guardan en `.env` o en las variables del proveedor
de despliegue. No se incluyen en el código ni en el repositorio.

## Administrador y acceso para la evaluación

El primer administrador se crea mediante un script de inicialización.

Configurar `ADMIN_EMAIL`, `ADMIN_NOMBRE` y `ADMIN_CLAVE` en `.env`
y ejecutar:

```powershell
npm.cmd run crear-admin
```

El script crea una cuenta activa con rol `administrador`.
Reutiliza las validaciones y el cálculo del hash de la capa lógica.

La creación y la asignación del rol se realizan en una transacción.
Si ya existe un administrador activo con ese email, conserva su contraseña.
Si el email pertenece a otra cuenta, rechaza la operación.

El registro público siempre crea cuentas con rol `usuario`.

Para la evaluación:

1. Abrir la aplicación publicada.
2. Iniciar sesión con las credenciales de administrador facilitadas
   por separado.
3. En el mismo navegador, abrir `/api/usuarios` para consultar el listado.
4. Abrir `/api/usuarios/:email/activo`, sustituyendo `:email` por el
   email de la cuenta que se desea consultar.

Estas consultas administrativas devuelven JSON.
La interfaz actual dispone de registro, login, estado de sesión y logout.

Las credenciales de evaluación se comunicarán junto con la entrega,
sin publicarlas en el repositorio.

## Cuenta de prueba local

Puede habilitarse `CREAR_USUARIO_PRUEBA=true` en desarrollo, configurando
su email y contraseña mediante las variables correspondientes.

El servidor crea una cuenta activa si no existe.
Si ya existe, conserva su estado y su contraseña.

Esta cuenta permite comprobar el login mientras el envío de correo
está pendiente. No activa automáticamente los nuevos registros.

Las variables de esta cuenta no se configuran en producción.
El administrador ficticio de las pruebas HTTP solo se crea en memoria
con `NODE_ENV=test`.

## API y permisos

| Método y ruta | Acceso y comportamiento |
| --- | --- |
| `GET /api/estado` | Público; informa del estado y la configuración de persistencia |
| `POST /api/usuarios` | Público; registra una cuenta pendiente con email, nombre y clave |
| `POST /api/login` | Público; comprueba credenciales y crea una sesión para una cuenta activa |
| `GET /api/sesion` | Requiere sesión; devuelve los datos públicos del usuario conectado |
| `POST /api/logout` | Invalida la sesión y elimina su cookie |
| `GET /api/usuarios` | Solo administrador; lista las cuentas |
| `GET /api/usuarios/:email/activo` | Solo administrador; consulta si una cuenta está activa |
| `DELETE /api/usuarios/:email` | Administrador o dueño de la cuenta; cambia su estado a eliminado |
| `POST /api/confirmar` | Valida email y token del enlace y activa la cuenta |
| `POST /api/confirmacion/reenviar` | Reenvía el correo de una cuenta pendiente con su email y contraseña |
| `GET /api/confirmar` | Ruta de confirmación anterior, conservada por compatibilidad |

Una cuenta está activa cuando su estado es `activo`.
Esto no significa que esté conectada en ese momento.

Los controles de acceso se aplican en el servidor:

- Sin sesión válida: respuesta 401.
- Sin permisos suficientes: respuesta 403.
- La sesión de una cuenta que deja de estar activa pierde el acceso.

Los datos públicos incluyen email, nombre, rol y estado.
La API no devuelve contraseñas, hashes ni códigos de confirmación.

## Persistencia y sesiones

Los usuarios se almacenan en PostgreSQL y sobreviven a los reinicios
del servidor.

La tabla incluye email, nombre, hash de contraseña, rol, estado
y los campos de confirmación.

El email es clave primaria. El repositorio utiliza consultas parametrizadas
y rechaza inserciones duplicadas.

Las sesiones se guardan actualmente en memoria.
Se mantienen entre recargas de página, pero se pierden al reiniciar
el servidor. En Cloud Run también se pierden si se sustituye la instancia
o se reduce el servicio a cero instancias. El almacenamiento de usuarios
y el de sesiones son distintos. Para conservar sesiones entre instancias
queda pendiente utilizar un almacén de sesiones compartido.

## Registro de actividad

`servidor/actividad.js` escribe una línea JSON por evento, con fecha
y tipo de actividad.

Se registran:

- Altas de usuarios.
- Login correcto o rechazado.
- Logout.
- Eliminaciones.
- Invalidación de sesiones.
- Accesos rechazados por falta de sesión o permisos.

Los logs aparecen en la terminal local y en Cloud Run → Observability → Logs.

El módulo permite únicamente los campos de contexto email, rol,
estado y código. No se le pasan contraseñas, hashes, tokens, cookies
ni cadenas de conexión.

## Pruebas automatizadas

Ejecutar las pruebas sin cargar `.env`:

```powershell
npm.cmd test
```

Si `DATABASE_URL` no está configurada en el entorno, la prueba
de PostgreSQL se omite.

Para ejecutar todas las pruebas con la configuración de `.env`:

```powershell
node --env-file=.env --test
```

Para ejecutar únicamente la prueba de PostgreSQL:

```powershell
node --env-file=.env --test pruebas/postgres.test.js
```

Hay 57 pruebas:

- 30 de lógica de usuarios.
- Una prueba HTTP con comprobaciones de sesión, logout y permisos.
- Una prueba de integración con PostgreSQL.
- Dos pruebas del formato de los logs y la exclusión de campos secretos.
- Seis pruebas de la variante de dominios permitidos.
- Seis pruebas de correo y confirmación, incluidos fallos SMTP y reenvíos.
- Once pruebas de identidad Google, vinculación y validación del flujo OAuth.

Se comprueban altas, duplicados, validaciones, hashes, estados de cuenta,
confirmación, login, consulta de sesión, logout, eliminación y permisos
de usuario y administrador.

Las pruebas HTTP arrancan un servidor independiente en un puerto libre
y utilizan datos ficticios en memoria.

La prueba de PostgreSQL utiliza una tabla temporal dentro de una
transacción y deshace sus cambios. No modifica las cuentas de la aplicación.

La persistencia tras reiniciar y el acceso y los logs del despliegue
también se han comprobado manualmente.

## Flujo de trabajo y CI/CD

Se utiliza GitHub Flow:

1. Crear una rama para cada cambio.
2. Desarrollar y ejecutar las pruebas en local.
3. Crear un pull request hacia main.
4. Esperar a que el CI termine correctamente.
5. Fusionar el pull request.
6. Comprobar el despliegue automático.

`.github/workflows/ci.yml` ejecuta las pruebas en cada pull request
y en los cambios de main.

El CI prepara una base PostgreSQL temporal y ejecuta las 57 pruebas.
No necesita las credenciales de Neon.

## Despliegue

El servicio principal está en Google Cloud Run. La configuración se ha
realizado en la consola de Google Cloud:

- Proyecto: `proyecto-de-procesos-513615`.
- Servicio: `procesos-martatosca`.
- Región: `europe-west1` (Bélgica).
- Repositorio: `martatoscaperez/Procesos_MartaTosca`; rama `main`.
- Cloud Build: buildpacks de Node.js, directorio raíz `/`, sin function target
  ni entrypoint personalizado. El arranque utiliza `npm start`.
- Acceso público e ingress `All`; la aplicación aplica su propio login
  y sus controles de acceso a la API.
- Facturación por petición, escalado automático con mínimo 0 y máximo 1.

En las variables del contenedor se configuran `DATABASE_URL`,
`SESSION_SECRET`, `NODE_ENV=production` y `ALLOWED_DOMAINS`.
Cloud Run asigna `PORT`; no debe fijarse manualmente.
Los secretos reales y el archivo `.env` no se suben al repositorio.

Cloud Build construye y despliega los cambios de `main` automáticamente.
El resultado se consulta en Build History y en las revisiones de Cloud Run.
GitHub Actions ejecuta las pruebas por separado: antes de integrar un PR
debe comprobarse que el CI termina correctamente.

PostgreSQL continúa alojado en Neon, con la misma base de datos que utilizaba
Render. La migración del servidor conserva las cuentas existentes y no
requiere crear una conexión Cloud SQL ni volver a inicializar la tabla.
Para una base nueva, ejecutar `servidor/esquema.sql` antes del primer arranque.

Con mínimo 0, el primer acceso después de un periodo de inactividad puede
tardar más y puede ser necesario volver a iniciar sesión.
El login del administrador se ha comprobado manualmente en Cloud Run.

Render está suspendido tras verificar el despliegue automático del PR #16
en Google Cloud. El archivo `render.yaml` conserva la configuración anterior.
Neon debe mantenerse activo porque sigue siendo la base de datos principal.

La aplicación publicada funciona independientemente del servidor local.

Referencia: [buildpacks de Node.js](https://docs.cloud.google.com/docs/buildpacks/nodejs)
y [sesiones en Cloud Run](https://docs.cloud.google.com/run/docs/configuring/session-affinity).

## Alcance de la entrega

- Hito 1: estructura por capas, gestión inicial de usuarios, API,
  pruebas y CI/CD.
- Hito 2: interfaz, comunicación con la API, registro, login,
  logout, sesión entre recargas y rutas protegidas.
- Hito 3: persistencia en PostgreSQL, secretos externos al código,
  administrador, permisos y registro de actividad.

El hito 4 está en desarrollo: la confirmación por correo ya está verificada
en producción. El acceso Google está implementado en código y pendiente
de configuración y comprobación real antes de publicar esta versión.
