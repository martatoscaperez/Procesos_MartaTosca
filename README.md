# HogarDu

En Tareas, «Lotería de tareas» permite indicar hasta 200 tareas, una fecha límite
y los compañeros participantes. El sorteo equilibra el número de tareas con una
diferencia máxima de una por persona. Las asignaciones se guardan juntas y
reintentar el mismo envío no duplica las tareas. El reparto equilibra cantidades,
sin ponderar la dificultad de cada tarea.

En Compra, los miembros pueden crear listas con nombre y añadir productos con
cantidad opcional. El botón general «Añadir Producto» crea una lista automática
al guardar el primer producto. Cada lista permite seguir añadiendo productos.
Las listas se comparten entre los miembros y se guardan en `listas_compra`.
La tabla se prepara mediante `npm run migrar-hogares`.

El calendario compartido permite a los miembros añadir eventos con título, fecha,
hora opcional o todo el día y descripción. Todos pueden consultar los eventos del
piso y cada autor puede editar o eliminar los suyos. Inicio muestra los tres
próximos eventos. Los eventos se guardan en PostgreSQL en `eventos_hogar`.
Para preparar esta tabla se utiliza `npm run migrar-hogares`.

HogarDu es una aplicación web para usar desde el navegador de un ordenador.
Por ahora, el desarrollo, el diseño y las pruebas se centran en ordenadores
de sobremesa y portátiles. La versión para móviles y tabletas queda fuera
del alcance de esta entrega.

## HogarDu · Crear y compartir un piso

Después de iniciar sesión, la tarjeta permite crear un piso o usar una invitación.
El creador recibe el rol de administrador del hogar, independiente de su rol
global. Cada cuenta puede consultar y seleccionar los pisos de los que es miembro.

Antes de usar esta funcionalidad por primera vez, ejecuta
`npm.cmd run migrar-hogares` con `DATABASE_URL` configurada.
La migración añade tablas y conserva las cuentas del hito 4.
Después reinicia el servidor con `npm.cmd start`.

Los códigos son válidos durante siete días. Solo se guarda su hash y se muestran
al crearlos. El administrador puede generar otro código, que invalida el anterior.
Al unirse, la cuenta recibe el rol de miembro. Las incorporaciones repetidas no
duplican usuarios ni cambian el rol del creador.

En la pestaña **Tareas**, los miembros se pueden apuntar tareas con fecha límite.
El administrador también puede asignarlas a otros miembros. Cada persona marca
sus propias tareas como hechas. La puntuación personal suma un punto por tarea
hecha a tiempo y descuenta uno por tarea vencida, aunque se complete después.
Los plazos se calculan por día en la zona horaria de Madrid.
**Mis tareas** muestra las asignaciones propias y **Todo el piso** las de todos.
Para repetir cada semana o cada mes, el administrador puede seleccionar y ordenar a los
participantes. Cambiar una asignación pendiente y sin vencer afecta solo a ese
turno. Al consultar las tareas se generan los turnos que correspondan y se
omiten los participantes que ya no pertenecen al piso.
Los turnos mensuales conservan el día elegido. Si el mes es más corto,
la tarea vence el último día del mes.

Proyecto individual de Procesos de Ingeniería del Software,
curso 2026–2027.

Aplicación web para organizar la convivencia en pisos compartidos. Los cuatro primeros hitos incorporaron arquitectura por capas, gestión de usuarios, sesiones, PostgreSQL, roles, confirmación por correo y acceso con Google.

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

El acceso con Google quedó desplegado y comprobado en Cloud Run durante el hito 4.
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

- Hito 4. Confirmación por correo con Brevo y acceso mediante Google OAuth, comprobados en Cloud Run.

## HogarDu · Diseño y plan de desarrollo

### Estado del desarrollo

La versión local permite crear pisos con foto y moneda, compartir invitaciones,
unirse, consultar miembros y abandonar un piso si queda un administrador activo.
El menú del piso incluye accesos a los módulos de convivencia. Las secciones
siguientes describen el diseño previsto y el plan de implementación.

### Producto y navegación

Tras entrar desde el navegador del ordenador, se elige o crea un hogar.
El inicio muestra tareas próximas, saldo personal, productos pendientes y
el último aviso. La navegación tiene Inicio, Tareas, Gastos, Compra,
Calendario y Hogar. Hogar reúne miembros, normas y avisos.

Identidad visual propuesta: fondo marfil, tarjetas blancas, verde oscuro,
acento coral y avatares con iniciales y un color elegible. Los formularios,
mensajes, estados vacíos, indicadores de carga y confirmaciones comparten
el mismo estilo. Las acciones principales tienen etiquetas y se pueden
usar con teclado.

### Arquitectura

Se amplía la separación existente entre presentación, comunicación, API,
lógica y datos. Los dominios son hogares, tareas, gastos, compra, normas,
eventos y avisos. Cada dominio tendrá rutas, servicio y repositorio cuando
se implemente. El servicio recibe el repositorio como dependencia.
Las rutas identifican al usuario por la sesión y comprueban su membresía.

PostgreSQL sigue siendo la fuente de verdad. Las migraciones son aditivas,
versionadas y transaccionales. Se prueban sobre una base aislada antes de
aplicarlas al entorno compartido. Las sesiones actuales están en memoria.
Para despliegues con varias instancias o continuidad entre reinicios se
añadirá un almacén de sesiones PostgreSQL compatible con express-session.

### Roles

El rol global de usuarios conserva el significado del hito 4.
El rol de administrador del hogar se guarda en la membresía y se limita
al hogar correspondiente. El creador recibe ese rol. Un usuario puede
pertenecer a varios hogares y selecciona el activo.

| Operación | Miembro activo | Administrador del hogar |
| --- | --- | --- |
| Consultar datos del hogar | Sí | Sí |
| Crear tareas y asignarlas a uno mismo | Sí | Sí |
| Asignar tareas a otros o configurar turnos | No | Sí |
| Completar tareas | Las asignadas a su membresía | Las asignadas a su membresía |
| Registrar gastos y liquidaciones | Sí | Sí |
| Editar gastos | Los que registró | Los que registró |
| Mantener la compra y crear eventos o avisos | Sí | Sí |
| Editar o archivar eventos y avisos | Los propios | Cualquiera del hogar |
| Leer y aceptar normas | Sí | Sí |
| Publicar normas y administrar invitaciones | No | Sí |
| Cambiar roles o dar de baja a miembros | No | Sí |

Debe quedar al menos un administrador activo. Antes de salir, el último
administrador transfiere el rol o archiva el hogar. Una baja conserva
historial y obligaciones económicas. Las invitaciones nuevas requieren
una cuenta activa y verificada.

### Modelo relacional propuesto

Los identificadores nuevos son UUID. Las fechas de auditoría usan TIMESTAMPTZ.
Los importes se guardan como enteros en céntimos. La primera entrega usa EUR.
El correo existente permanece como clave de usuarios y se referencia desde
membresias. No se necesita cambiar la autenticación.

| Tabla | Campos principales y restricciones |
| --- | --- |
| usuarios | Tabla existente. Conservar email, nombre, clave_hash, google_sub, rol y estado. |
| perfiles | usuario_email PK/FK a usuarios, color_avatar de paleta permitida. Avatar de iniciales derivado del nombre. |
| hogares | id PK, nombre, zona_horaria por defecto Europe/Madrid, moneda EUR, creado_en, archivado_en. |
| membresias | id PK, hogar_id FK, usuario_email FK, rol administrador/miembro, incorporado_en, baja_en. UNIQUE(hogar_id, usuario_email). |
| invitaciones | id PK, hogar_id FK, token_hash UNIQUE, creador_id FK a membresias, caduca_en, usos_maximos, usos_actuales, revocada_en. |
| planes_tarea | id PK, hogar_id FK, titulo, zona, frecuencia ninguna/semanal/mensual, modo manual/rotacion, proxima_fecha DATE, activo. |
| turnos_tarea | hogar_id, plan_id FK, membresia_id FK, posicion. UNIQUE(plan_id, membresia_id) y UNIQUE(plan_id, posicion). |
| tareas | id PK, hogar_id FK, plan_id opcional, titulo y zona como copia histórica, responsable_id FK, vence_en TIMESTAMPTZ, completada_en, completada_por_id, cancelada_en, version. UNIQUE(plan_id, vence_en). |
| gastos | id PK, hogar_id FK, creador_id FK, pagador_id FK, concepto, categoria, importe_centimos positivo, fecha DATE, creado_en, anulado_en, version. |
| repartos_gasto | hogar_id, gasto_id FK, membresia_id FK, importe_centimos no negativo. PK(gasto_id, membresia_id). |
| liquidaciones | id PK, hogar_id FK, deudor_id FK, acreedor_id FK, importe_centimos positivo, fecha, registrado_por_id, anulado_en. Emisor y receptor distintos. |
| articulos_compra | id PK, hogar_id FK, nombre, cantidad como texto, creador_id FK, comprado_en, comprador_id FK, gasto_id opcional UNIQUE, archivado_en, version. |
| versiones_normas | id PK, hogar_id FK, numero, contenido, publicada_por_id FK, publicada_en. UNIQUE(hogar_id, numero). |
| aceptaciones_normas | hogar_id, version_id FK, membresia_id FK, aceptada_en. PK(version_id, membresia_id). |
| eventos | id PK, hogar_id FK, creador_id FK, titulo, descripcion, empieza_en, termina_en, version, cancelado_en. Fin igual o posterior al inicio. |
| avisos | id PK, hogar_id FK, autor_id FK, texto, urgente, creado_en, editado_en, archivado_en, version. |
| movimientos_tarea | id PK, hogar_id FK, tarea_id FK UNIQUE, membresia_id FK, puntos +1/-1, motivo, ocurrido_en. |

Las referencias a membresías deben usar claves foráneas compuestas
(hogar_id, membresia_id) contra UNIQUE(hogar_id, id) de membresias.
Se aplica el mismo patrón a tareas, planes, gastos, artículos y versiones.
Así se impide referenciar elementos de otro hogar incluso por error.
Las tablas históricas usan restricciones de borrado y bajas lógicas.
Se indexan hogar_id con las columnas utilizadas en filtros de fechas,
estado y responsable. Las listas se paginan.

### Reglas funcionales

#### Hogares e invitaciones

Crear un hogar y su primera membresía es una única transacción. El código
de invitación se genera con aleatoriedad criptográfica, se muestra al
crearlo y se almacena como hash. Se puede revocar y regenerar.
Una invitación dura siete días y permite diez incorporaciones por defecto.
El consumo se bloquea en la base y se actualiza junto a la membresía.
Los reintentos de un miembro ya incorporado no consumen otro uso.

#### Tareas, rotación y equidad

Una tarea puntual se asigna manualmente. Una tarea recurrente tiene una
lista ordenada de miembros activos. Cada nueva ocurrencia utiliza el
siguiente turno y conserva su responsable aunque cambie el orden futuro.
Una baja antes de crear la siguiente ocurrencia se omite en la rotación.
La baja con tareas pendientes exige reasignarlas en una transacción.
Cada miembro solo completa su tarea. La cancelación se registra y no
puntúa. El administrador puede corregir una asignación con historial.

La fecha visible se interpreta al final del día en la zona horaria del
hogar. Las recurrencias mensuales conservan el día elegido; si ese día no
existe, usan el último del mes sin alterar el día base del siguiente.
Un proceso periódico genera las ocurrencias y registra vencimientos.
La restricción única del plan y vencimiento permite reintentar el proceso.

Se conserva la regla acordada de +1 por tarea terminada a tiempo y -1 por
tarea vencida. Una tarea hecha tarde conserva el descuento y queda hecha
en el historial. Solo se genera un movimiento de puntos por ocurrencia.
La finalización y la evaluación del vencimiento bloquean la misma tarea.
El orden del proceso no altera el resultado basado en el instante real.
El ranking mensual muestra puntos y, además, tareas asignadas, hechas a
tiempo y porcentaje de cumplimiento para contextualizar cargas distintas.
El mes se atribuye al vencimiento. Los empates comparten reconocimiento.

#### Gastos y balances

Un gasto elige pagador y participantes del mismo hogar. El reparto puede
ser equitativo o mediante importes personalizados. La suma de cuotas
debe coincidir exactamente con el total y se valida en una transacción.
En reparto igual, los céntimos sobrantes se asignan de forma determinista
por id de membresía. El servidor calcula y valida los importes.

Saldo por miembro = pagos de gastos - cuotas asignadas
                  + liquidaciones enviadas - liquidaciones recibidas.

Un saldo positivo indica que debe recibir dinero. Uno negativo indica
que debe aportar dinero. La suma de los saldos del hogar es cero.
Una propuesta de transferencias conecta deudores con acreedores para
cancelar los saldos. Es una sugerencia derivada del balance.
Registrar una liquidación representa un pago que ya ocurrió.
No se realizan transferencias bancarias desde la aplicación.
Los importes de la API usan céntimos enteros y límites comprobados.
Las correcciones dejan auditoría y recalculan el balance.

#### Compra y conversión a gasto

Todos los miembros activos pueden añadir, editar y marcar artículos.
Una actualización establece el estado deseado, evitando alternancias
accidentales al reintentar. Las ediciones usan una columna version.
Si dos personas editan la misma versión, la segunda recibe un conflicto
409 y puede recargar los datos.

Al convertir un artículo comprado, el usuario confirma importe, pagador
y reparto. El servidor bloquea el artículo, crea el gasto y las cuotas
y enlaza gasto_id en la misma transacción. Un segundo intento devuelve
el gasto existente. Si falla la validación, no se crea nada.

#### Normas y aceptación

Editar o eliminar una norma produce una versión nueva del reglamento,
sin sobrescribir versiones aceptadas. Los miembros leen la versión
vigente y aceptan explícitamente su identificador. Aceptar dos veces la
misma versión es una operación idempotente.
Una publicación posterior muestra aceptación pendiente para esa versión.
La pantalla puede archivar todas las normas mediante una versión vacía.

#### Calendario y avisos

El calendario permite crear y consultar eventos del hogar en vista mensual
y lista próxima. Las fechas se almacenan en UTC y se presentan en la zona
del hogar. Se incluye título, intervalo y descripción.
El tablón publica avisos con autor, fecha y prioridad urgente.
La primera entrega adopta tablón de avisos. Un chat requeriría además
mensajes, paginación de conversación y reglas de retención.

#### Actualización compartida

El cliente consulta cambios cada diez segundos mientras la pestaña está
visible y actualiza tras cada operación propia o al recuperar el foco.
Se cancelan solicitudes al cambiar de hogar y se ignoran respuestas de
un hogar anterior. Los cambios simultáneos usan versionado y transacciones.
Esta entrega ofrece actualización periódica compartida. Si se exige entrega
inmediata por servidor, se añadirá SSE con difusión entre instancias.

### API propuesta

Todas las rutas de hogar usan sesión válida y membresía activa. El hogar
activo se envía en la ruta; la autoridad se verifica en el servidor.

| Área | Rutas |
| --- | --- |
| Hogares | GET/POST /api/hogares; GET/PATCH /api/hogares/:id |
| Miembros | GET /api/hogares/:id/miembros; PATCH /api/hogares/:id/miembros/:miembro |
| Invitaciones | POST /api/hogares/:id/invitaciones; POST /api/invitaciones/aceptar; DELETE /api/hogares/:id/invitaciones/:invitacion |
| Tareas | GET/POST /api/hogares/:id/tareas; POST /api/hogares/:id/tareas/:tarea/completar; POST /api/hogares/:id/planes-tarea |
| Compra | GET/POST /api/hogares/:id/compra; PATCH /api/hogares/:id/compra/:articulo; POST /api/hogares/:id/compra/:articulo/gasto |
| Gastos | GET/POST /api/hogares/:id/gastos; PATCH /api/hogares/:id/gastos/:gasto; GET /api/hogares/:id/balances; POST /api/hogares/:id/liquidaciones |
| Normas | GET/POST /api/hogares/:id/normas; PUT /api/hogares/:id/normas/:version/aceptacion |
| Eventos | GET/POST /api/hogares/:id/eventos; PATCH/DELETE /api/hogares/:id/eventos/:evento |
| Avisos | GET/POST /api/hogares/:id/avisos; PATCH/DELETE /api/hogares/:id/avisos/:aviso |
| Ranking | GET /api/hogares/:id/ranking?mes=AAAA-MM |

Las peticiones de escritura validan origen y token CSRF. Los textos se
renderizan como texto plano. Se limitan el tamaño de cuerpos y los intentos
de invitación. Los errores son JSON y los recursos ajenos no revelan datos.
Los secretos permanecen en el entorno.

### Plan de desarrollo por hitos y PBIs

#### Hito 1 · Entrar a mi hogar

1. Crear, seleccionar y unirse a un hogar.
   Migración de hogares, membresías e invitaciones; permisos; pantallas;
   prueba con dos miembros y una cuenta ajena.
2. Navegar por HogarDu y configurar el perfil.
   Diseño adaptable; avatar de iniciales y color; navegación y resumen.

#### Hito 2 · Organizar la convivencia

3. Gestionar tareas y turnos.
   Tareas manuales; recurrencias; rotación; historial; puntos y pruebas
   de concurrencia entre completar y vencer.
4. Compartir la compra.
   Alta, edición, marcado, versionado y comprobación con dos sesiones.
5. Publicar normas y registrar aceptaciones.
   Versiones, permisos, publicación y aceptación de la versión vigente.

#### Hito 3 · Gastos y coordinación

6. Registrar gastos y consultar balances.
   Céntimos, reparto, liquidaciones, propuesta de transferencias y pruebas
   de que cuotas y saldos cuadran.
7. Convertir compras en gastos.
   Confirmación del reparto y conversión atómica resistente a reintentos.
8. Consultar calendario y publicar avisos.
   Eventos, vista mensual, tablón y actualización compartida.

#### Hito 4 · Verificación y entrega

9. Probar y publicar el incremento.
   Migraciones aisladas; permisos entre hogares; cuentas antiguas;
   pruebas de fechas y dinero; navegación en navegador de escritorio; CI; migración de producción;
   despliegue en Cloud Run; pruebas de humo y evidencia para la memoria.

Se implementa cada funcionalidad de extremo a extremo. Cada PBI tiene
rama, migración cuando procede, interfaz, API y validación antes de su PR.
El primer incremento demostrable es crear un hogar, invitar a una segunda
cuenta y ver el mismo listado de miembros desde ambas.

### Plazo

El alcance completo incluye recurrencias, dinero, aceptación versionada
y concurrencia. No se da por asegurada una entrega completa en tres días.
Si sigue vigente ese plazo, la primera versión se centra en hogares,
tareas manuales, compra, normas y gastos equitativos. La rotación,
repartos personalizados, calendario y conversión a gasto se planifican
según el avance comprobado.

Las tareas pendientes se pueden editar desde «Editar» en su menú: el diálogo permite cambiar nombre, fecha límite, frecuencia y responsable. Una repetición necesita fecha de inicio. La edición conserva las tareas completadas; si cambia el responsable, las próximas repeticiones se asignan a ese compañero.

Gastos compartidos: listado de todos los gastos, alta y edición de concepto, fecha, pagador y reparto igual o personalizado. Los importes se calculan en céntimos y se guardan en PostgreSQL en movimientos_hogar. Saldos compensa las deudas y permite registrar devoluciones parciales o completas, sin transferencias bancarias. Todos los miembros pueden gestionar los movimientos de su piso; los cambios actualizan los saldos. Las solicitudes nuevas llevan un identificador para evitar duplicados al reintentar. Ejecutar npm run migrar-hogares para preparar la tabla.

Normas del piso: todos sus miembros pueden consultarlas. Solo quien tenga el rol administrador dentro de ese piso puede añadir, editar o eliminar normas; el servidor y la consulta de escritura verifican ese permiso, independientemente del rol global de la cuenta. Se guardan en normas_hogar con título y contenido.

Chat de Avisos: mensajes compartidos con autor y fecha; cada miembro puede editar o borrar solo los suyos. El punto verde de la barra indica avisos nuevos de otros compañeros. Al abrir el chat se marca como leído hasta el último mensaje cargado, por usuario y piso en lecturas_avisos; los mensajes posteriores siguen sin leer. El navegador mantiene una conexión SSE autenticada: recibe una señal al publicar, editar o eliminar y recupera los mensajes con una petición autorizada. PostgreSQL LISTEN/NOTIFY propaga las señales entre instancias. EventSource reconecta automáticamente y vuelve a consultar el historial para recuperar cambios perdidos. No se consulta el chat cada 10 segundos. La conexión se renueva cada cuatro minutos para revisar sesión y pertenencia al piso. Los propios mensajes y las ediciones no generan avisos nuevos.
