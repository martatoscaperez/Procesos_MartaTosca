# Piso compartido

Proyecto individual de Procesos de Ingeniería del Software,
curso 2026–2027.

Aplicación web para organizar la vida en un piso compartido.

Esta entrega cubre los hitos 1, 2 y 3: arquitectura por capas,
gestión de usuarios, frontend, sesiones, rutas protegidas,
persistencia en PostgreSQL, roles y registro de actividad.

Aplicación publicada:
https://piso-compartido-louo.onrender.com

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
- Render: despliega automáticamente los cambios integrados en main.

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

El código incluye la lógica y la ruta de confirmación mediante token,
pero el envío de correo no está conectado.

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
- `NODE_ENV`: `development` en local y `production` en Render.
  Las pruebas HTTP utilizan `test`.
- `PORT`: puerto opcional; por defecto, 3000.

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
| `GET /api/confirmar` | Valida email y token; el envío de correo está pendiente |

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
el servidor. El almacenamiento de usuarios y el de sesiones son distintos.

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

Los logs aparecen en la terminal local y en Render → Logs.

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

Hay 34 pruebas:

- 30 de lógica de usuarios.
- Una prueba HTTP con comprobaciones de sesión, logout y permisos.
- Una prueba de integración con PostgreSQL.
- Dos pruebas del formato de los logs y la exclusión de campos secretos.

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

El CI prepara una base PostgreSQL temporal y ejecuta las 34 pruebas.
No necesita las credenciales de Neon.

## Despliegue

La configuración del servicio está en `render.yaml`.

Render utiliza:

- Rama: `main`.
- Instalación: `npm ci`.
- Arranque: `npm start`.
- Despliegue automático al integrar cambios en main.

En Render se configuran `DATABASE_URL`, `SESSION_SECRET`
y `NODE_ENV=production`.

La tabla se prepara ejecutando `servidor/esquema.sql` en la base de datos
del despliegue.

No se sube `.env`: Render utiliza sus propias variables de entorno.

La instancia gratuita puede tardar en responder después de un periodo
de inactividad.

La aplicación publicada funciona independientemente del servidor local.

## Alcance de la entrega

- Hito 1: estructura por capas, gestión inicial de usuarios, API,
  pruebas y CI/CD.
- Hito 2: interfaz, comunicación con la API, registro, login,
  logout, sesión entre recargas y rutas protegidas.
- Hito 3: persistencia en PostgreSQL, secretos externos al código,
  administrador, permisos y registro de actividad.

El envío de correo de confirmación y el inicio de sesión mediante OAuth
corresponden al hito 4 y quedan fuera del alcance de esta entrega.