# Sprint 1 · Base técnica y acceso a la aplicación

**Cierre confirmado: 3 de noviembre de 2026.** El Sprint 2 comenzó el 4 de noviembre. El historial de Git contiene el inicio del repositorio el 30 de septiembre y las integraciones de esta etapa durante octubre y el 3 de noviembre; una fecha de commit no se utiliza como registro de horas trabajadas.

## Objetivo

El primer incremento consistió en tener una aplicación conectada desde el navegador hasta el almacenamiento, con gestión de cuentas, acceso protegido y una publicación que pudiera utilizarse sin arrancar el servidor local.

## Hitos y resultados

| Hito | Resultado de la etapa | Evidencia |
| --- | --- | --- |
| H1 · Estructura y backend | Separación inicial de API, lógica y datos, gestión de usuarios en memoria, primeras pruebas y CI. | [PR 1](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/1) y [PR 2](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/2). |
| H2 · Interfaz y sesión | Frontend con comunicación separada, registro local, contraseña con bcrypt, login, consulta de sesión, logout y protección de rutas. | [PR 6](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/6), [PR 7](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/7), [PR 9](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/9) y [PR 10](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/10). |
| H3 · Persistencia y administración | PostgreSQL para usuarios, configuración de secretos, inicialización del administrador, permisos y logs de actividad. | [PR 11](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/11), [PR 12](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/12) y [PR 13](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/13). |
| H4 · Servicios externos y publicación | Confirmación de cuentas mediante correo, acceso con Google y vinculación de identidad; publicación principal en Google Cloud Run. | [PR 16](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/16), [PR 17](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/17) y [PR 18](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/18). |

Los requisitos de esta base se recogen en [RF-01 a RF-06](requisitos.md#base-del-sprint-1). Los enlaces de los PR conservan los archivos y las decisiones de cada momento; las carpetas actuales cambiaron en la revisión de arquitectura del 24 de noviembre.

## Flujo entregado

La persona se registra, recibe el enlace de confirmación, confirma la cuenta y puede iniciar sesión. La API comprueba la identidad antes de las operaciones privadas y aplica los permisos correspondientes. La sesión se recupera al recargar mientras siga disponible en el proceso; cerrar sesión la invalida.

El correo confirmado, la contraseña y la identidad Google son responsabilidades relacionadas pero diferentes. Las contraseñas se almacenan con bcrypt y no se devuelven al cliente. Una cuenta local no se vincula a Google únicamente por compartir la dirección de correo.

## Comprobación

Las pruebas de usuarios verifican altas, duplicados, estados, hashes y acceso. Las pruebas HTTP comprueban sesiones y permisos, y las de PostgreSQL comprueban persistencia. Correo e identidad Google cuentan con pruebas del contrato y del tratamiento de errores. La configuración y comprobación del entorno publicado se describen en el [README](../README.md).

La suite actual de 99 pruebas incluye esta base y el incremento posterior; **no es el número de pruebas que había al cerrar el Sprint 1**. Los resultados actuales se identifican con su revisión en el [registro de cambios](log.md).

## Retrospectiva

Esta etapa me permitió comprobar el recorrido completo antes de añadir las funciones de convivencia. La separación inicial facilitó sustituir memoria por PostgreSQL y probar las reglas con adaptadores distintos.

También vi que una prueba simulada de correo o Google no sustituye la comprobación de su configuración real. Para la entrega resultó necesario revisar tanto el código como el servicio publicado y distinguir un fallo de acceso de una cuenta pendiente de confirmación.

Como aprendizaje para el siguiente incremento, mantuve la relación entre cambios, pruebas y pull requests. El crecimiento del proyecto hizo necesaria una revisión más estricta de las dependencias y las carpetas, que se realizó el 24 de noviembre y se documenta en [arquitectura](arquitectura.md).
