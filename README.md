# HogarDu

Aplicación web para organizar un piso compartido: tareas y turnos, compra, gastos, calendario, normas y avisos en tiempo real. Cada cuenta accede a sus pisos con los permisos correspondientes.

**[Abrir la app desplegada](https://procesos-martatosca-569228981488.europe-west1.run.app/)** · **[Documentación del proyecto](docs/index.md)**

Proyecto individual de Procesos de Ingeniería del Software, curso 2026–2027. La versión entregada está orientada a ordenador.

## Tecnologías

Node.js 24, Express, PostgreSQL en Neon y JavaScript, HTML y CSS. Pruebas con Node Test Runner, CI con GitHub Actions y despliegue en Google Cloud Run.

## Ejecutar en local

Se necesita Node.js 24, npm y una base PostgreSQL.

1. Clonar el proyecto y entrar en su carpeta:

   ```powershell
   git clone https://github.com/martatoscaperez/Procesos_MartaTosca.git
   cd Procesos_MartaTosca
   npm.cmd ci
   Copy-Item .env.example .env
   ```

2. Completar `.env` con `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=development`, `ALLOWED_DOMAINS` y `APP_URL=http://localhost:3000`.

3. En una base nueva, ejecutar [esquema.sql](servidor/datos/esquema.sql) en PostgreSQL y preparar las tablas del piso:

   ```powershell
   npm.cmd run migrar-hogares
   ```

4. Arrancar y abrir [localhost:3000](http://localhost:3000/):

   ```powershell
   npm.cmd start
   ```

Para detenerlo, pulsa **Ctrl + C**. En Linux y macOS utiliza `npm` en lugar de `npm.cmd`.

El registro con confirmación necesita configurar SMTP; Google es opcional. La [guía de configuración](docs/configuracion.md) explica los proveedores, las migraciones y la creación del administrador. Los valores reales de `.env` no se publican en Git.

## Pruebas

```powershell
npm.cmd test
```

Para incluir las integraciones PostgreSQL utilizando `.env`:

```powershell
node --env-file-if-exists=.env --test
```

GitHub Actions ejecuta las pruebas con una base temporal. La comprobación de la app publicada con dos cuentas se describe en [procesos](docs/procesos.md#reproducir-la-comprobación-publicada).

## Documentación

En [docs](docs/index.md) están los requisitos, la arquitectura por capas, las decisiones, los procesos, el historial y los informes de los dos sprints.

Para configuración y despliegue, consulta [configuracion.md](docs/configuracion.md).
