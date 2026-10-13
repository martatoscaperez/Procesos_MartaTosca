# Piso compartido

Proyecto individual de Procesos de Ingeniería del Software,
curso 2026–2027.

Aplicación web para organizar las tareas domésticas de un piso compartido.
Actualmente incluye registro, inicio y cierre de sesión, rutas protegidas
y persistencia de usuarios en PostgreSQL.

## Tecnologías

- Node.js 24 y JavaScript: permiten usar el mismo lenguaje en cliente y servidor.
- Express: sirve el frontend y gestiona las rutas de la API.
- bcrypt: almacena contraseñas mediante un hash diseñado para contraseñas.
- express-session: mantiene la identidad del usuario entre peticiones.
- PostgreSQL y pg: guardan los usuarios de forma persistente mediante consultas SQL.
- Neon: aloja la base de datos PostgreSQL.
- Node Test Runner: ejecuta las pruebas automatizadas.
- GitHub Actions: ejecuta las pruebas en los pull requests y en main.
- Render: despliega automáticamente los cambios integrados en main.

## Arquitectura

El backend está separado en tres capas:

- `servidor/api.js`: recibe peticiones HTTP y aplica los controles de acceso.
- `servidor/logica.js`: contiene las reglas de gestión de usuarios.
- `servidor/datos-postgres.js`: consulta y guarda usuarios en PostgreSQL.

También existen:

- `servidor/conexion.js`: configura las conexiones a PostgreSQL.
- `servidor/esquema.sql`: define la tabla de usuarios.
- `servidor/datos.js`: repositorio en memoria utilizado en las pruebas.

El recorrido es API → lógica → datos.

El frontend separa:

- `cliente/index.html`, `cliente/estilos.css` y `cliente/controlador.js`:
  presentación e interacción.
- `cliente/comunicacion/rest.js`: comunicación con la API.

El backend sirve el frontend desde el mismo origen.
El cliente no accede directamente a la base de datos.

## Ejecutar en local

Requiere Node.js 24, npm y una base de datos PostgreSQL.

1. Instalar las dependencias:

   ```powershell
   npm.cmd ci
   ```

2. Copiar `.env.example` a `.env` y configurar las variables.
   `.env` está excluido de Git.

3. Ejecutar el contenido de `servidor/esquema.sql` en PostgreSQL,
   por ejemplo desde el SQL Editor de Neon.

4. Arrancar el servidor:

   ```powershell
   npm.cmd start
   ```

5. Abrir http://localhost:3000.

Para detener el servidor, pulsar Ctrl+C en su terminal.

## Variables de entorno

- `DATABASE_URL`: cadena de conexión a PostgreSQL.
- `SESSION_SECRET`: secreto utilizado para firmar la cookie de sesión.
- `PORT`: puerto opcional; por defecto, 3000.
- `NODE_ENV`: `development` en local, `production` en el despliegue
  y `test` para el servidor de las pruebas.
- `CREAR_USUARIO_PRUEBA`: habilita la cuenta de prueba si vale `true`,
  únicamente en desarrollo o pruebas.
- `USUARIO_PRUEBA_EMAIL`: email de la cuenta de prueba.
- `USUARIO_PRUEBA_CLAVE`: contraseña de la cuenta de prueba.

Los valores reales se configuran en `.env` o en el proveedor de despliegue.
No deben subirse al repositorio.

## Cuenta de prueba local

Al habilitar `CREAR_USUARIO_PRUEBA`, se crea una cuenta activa si no existe.
Si ya existe, se conserva su estado y su contraseña.

Permite comprobar el login, el mantenimiento de sesión al recargar
y el cierre de sesión mientras el envío de correo está pendiente.

Las variables de esta cuenta de prueba no se configuran en producción.

## Pruebas

Ejecutar las pruebas de lógica y HTTP:

```powershell
npm.cmd test
```

La prueba de PostgreSQL se omite si `DATABASE_URL` no está configurada
en el entorno del proceso.

Para ejecutar todas las pruebas utilizando la configuración de `.env`:

```powershell
node --env-file=.env --test
```

Para ejecutar únicamente la prueba de PostgreSQL:

```powershell
node --env-file=.env --test pruebas/postgres.test.js
```

Actualmente hay 32 pruebas: 30 de lógica, una de sesión y permisos HTTP,
y una de integración con PostgreSQL.

La prueba de PostgreSQL utiliza una tabla temporal y deshace sus cambios.
Las pruebas HTTP utilizan un servidor independiente con datos en memoria.

GitHub Actions prepara PostgreSQL temporal y ejecuta las 32 pruebas
en cada pull request y en cada cambio de main.

## API y permisos

- `GET /api/estado`: consulta el estado de la aplicación.
- `POST /api/usuarios`: registra una cuenta pendiente con email, nombre y clave.
- `POST /api/login`: inicia sesión con una cuenta activa.
- `GET /api/sesion`: obtiene los datos públicos del usuario conectado.
- `POST /api/logout`: invalida la sesión y elimina la cookie.
- `GET /api/usuarios`: lista usuarios; requiere administrador.
- `GET /api/usuarios/:email/activo`: consulta el estado; requiere administrador.
- `DELETE /api/usuarios/:email`: elimina una cuenta; requiere ser su dueño
  o administrador.
- `GET /api/confirmar`: valida un código de confirmación.
  El envío de correo todavía no está conectado.

Las rutas protegidas devuelven 401 si no hay sesión válida y 403
si el usuario no tiene permisos.

Las contraseñas y sus hashes no se devuelven al cliente.

## Persistencia y sesiones

Los usuarios se guardan en PostgreSQL y sobreviven al reinicio del servidor.

Las sesiones todavía se guardan en memoria: se mantienen entre recargas
de la página, pero se pierden al reiniciar el servidor.

## Flujo de trabajo

Cada cambio se desarrolla en una rama propia.
Se ejecutan las pruebas en local y se abre un pull request hacia main.
Solo se integra cuando el CI está en verde.

## Despliegue

Aplicación: https://piso-compartido-louo.onrender.com

La configuración del servicio está en `render.yaml`.

Render instala las dependencias con `npm ci` y arranca con `npm start`.
Los cambios integrados en main se despliegan automáticamente.

En Render deben configurarse `DATABASE_URL`, `SESSION_SECRET`
y `NODE_ENV=production`.

La tabla se prepara previamente ejecutando `servidor/esquema.sql`
en la base de datos del despliegue.

## Pendiente del hito 3

- Preparar el primer administrador y documentar su acceso.
- Comprobar mediante pruebas las operaciones permitidas al administrador.
- Incorporar el registro de actividad relevante.

Las credenciales de evaluación se comunicarán por separado,
sin publicarlas en el repositorio.

## Administrador

El primer administrador se crea mediante un script de inicialización.

Configurar en `.env`:

- `ADMIN_EMAIL`
- `ADMIN_NOMBRE`
- `ADMIN_CLAVE`

Ejecutar:

```powershell
npm.cmd run crear-admin