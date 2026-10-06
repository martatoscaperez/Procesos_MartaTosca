# Piso compartido

Proyecto individual de Procesos de Ingeniería del Software,
curso 2026–2027.

Aplicación web para organizar las tareas domésticas de un piso compartido.
Actualmente incluye una página inicial y la gestión básica de usuarios
en memoria.

## Tecnologías

- JavaScript y Node.js: permiten desarrollar el servidor en JavaScript.
- Express: gestiona las rutas de la API y sirve la página web.
- Node Test Runner: ejecuta las pruebas automatizadas.
- GitHub Actions: ejecuta las pruebas en los pull requests y en main.
- Render: aloja la aplicación y despliega automáticamente los cambios de main.

## Arquitectura

El backend está separado en tres capas:

- `servidor/api.js`: recibe peticiones HTTP y devuelve respuestas.
- `servidor/logica.js`: aplica las reglas de gestión de usuarios.
- `servidor/datos.js`: almacena y consulta usuarios en memoria.

El recorrido es: **API → lógica → datos**.

El backend sirve el frontend desde la carpeta `cliente`.

## Ejecutar en local

Requiere Node.js 24 y npm. Desde la raíz del proyecto:

```sh
npm ci
npm start
```

Abrir http://localhost:3000.

En PowerShell puede utilizarse `npm.cmd` en lugar de `npm`.

## Pruebas

```sh
npm test
```

Las siete pruebas comprueban altas, duplicados, email vacío,
listado, estado pendiente y eliminación, incluyendo casos de error.

## API

- `GET /api/estado`: consulta el estado del sistema.
- `POST /api/usuarios`: crea una cuenta pendiente enviando un email en JSON.
- `GET /api/usuarios`: lista usuarios.
- `GET /api/usuarios/:email/activo`: consulta si una cuenta está activa.
- `DELETE /api/usuarios/:email`: marca una cuenta como eliminada.

Los datos se pierden al reiniciar el servidor.
La autenticación y los permisos todavía están pendientes:
usar únicamente datos ficticios.

## Despliegue

Aplicación: https://piso-compartido-louo.onrender.com

Render utiliza el plan Free, la rama `main`, `npm ci` para instalar
dependencias y `npm start` para arrancar. Auto-Deploy está configurado
en On Commit.

El servicio puede tardar en responder tras un periodo de inactividad.
Está pendiente guardar una configuración reproducible del despliegue
en el repositorio.

## Variables de entorno

- `PORT`: opcional; por defecto se utiliza 3000.

## Próximos pasos

Completar el frontend, autenticación, sesiones, roles y persistencia.
El acceso como administrador se documentará cuando esté implementado.
Las credenciales de prueba no se publicarán en el repositorio.