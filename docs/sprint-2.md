# Sprint 2 · Organización de la convivencia

**Periodo confirmado: del 4 al 17 de noviembre de 2026.** El Sprint 1 terminó el 3 de noviembre. Las integraciones y revisiones del 23 y 24 de noviembre se registran después del cierre, sin desplazar estas fechas.

## Objetivo y alcance de entrega

El objetivo fue pasar de una aplicación con acceso y cuentas a una herramienta compartida para el día a día del piso: organizar tareas, compra, gastos y convivencia, con datos persistentes y permisos por hogar.

La lista vigente se organiza en cuatro hitos. Incluye el comportamiento entregado y los ajustes posteriores que se identifican más abajo.

| Hito | Contenido implementado | Requisitos |
| --- | --- | --- |
| H1 · Hogares y navegación | Crear o unirse a un piso, invitaciones, membresías, permisos, Inicio y navegación por secciones. Los perfiles y la edición del nombre y foto del hogar se completaron en la revisión del 23. | [RF-07](requisitos.md#rf-07), [RF-08](requisitos.md#rf-08), [RF-09](requisitos.md#rf-09) y [RF-20](requisitos.md#rf-20). |
| H2 · Tareas, compra y normas | Alta y edición de pendientes, turnos, lotería equilibrada, finalización, foto y comentarios, puntos y podio; listas compartidas de compra y normas gestionadas por el administrador. | [RF-10](requisitos.md#rf-10) a [RF-15](requisitos.md#rf-15) y [RF-18](requisitos.md#rf-18). |
| H3 · Gastos y coordinación | Gastos con reparto, cuentas pendientes y devoluciones, calendario y chat de avisos con lectura individual y SSE. | [RF-16](requisitos.md#rf-16), [RF-17](requisitos.md#rf-17) y [RF-19](requisitos.md#rf-19). |
| H4 · Verificación y entrega | Pruebas de reglas, permisos y persistencia, integración en GitHub, publicación en Cloud Run y comprobación con dos sesiones. | [Calidad y límites](requisitos.md#calidad-y-límites), [procesos](procesos.md#6-desarrollo-pruebas-y-publicación). |

## Seguimiento y dedicación

En el seguimiento del Sprint 2 se utilizaron los identificadores **P39 a P45**. La tabla conserva esa referencia, resume el resultado real y recoge los tiempos que facilité para esas tareas. No se han obtenido convirtiendo estimaciones del tablero ni midiendo el intervalo entre commits.

| PBI del seguimiento | Resultado documentado en HogarDu | Dedicación comunicada |
| --- | --- | --- |
| P39 · Crear un piso y unirse con un código | Alta de hogares, invitaciones y membresías. | 2 h |
| P40 · Ver el plano interactivo del piso | Alcance reformulado como navegación por secciones y resumen del hogar. El plano interactivo no se entregó. | 1 h |
| P41 · Apuntarse tareas por zona | Gestión de tareas y responsables dentro del piso. La interfaz final no clasifica tareas por habitaciones. | 2 h |
| P42 · Completar tareas y consultar el historial | Pendientes y hechas, finalización, foto opcional y consulta del resultado. | 2 h |
| P43 · Compartir la lista de la compra | Listas, productos, marcado y persistencia compartida. | 1 h |
| P44 · Ver los puntos de la semana | Alcance entregado como ranking mensual con puntuación por tareas y podio. | 1 h |
| P45 · Probar y publicar la versión final | Validación e integración del incremento y comprobación de su publicación. | 1 h 30 min |
| **Total comunicado** | **Siete PBI del seguimiento** | **10 h 30 min** |

Los nombres originales de P40, P41 y P44 no describen literalmente la interfaz final. Por eso se explican los cambios de alcance en lugar de dar por hecho un plano, zonas o un ranking semanal. Los gastos, normas, calendario y avisos forman parte de la aplicación entregada, pero no se les asigna aquí un identificador PBI nuevo que no se haya contrastado en el seguimiento.

Esta tabla no modifica DoneTonic. Las revisiones del 23 y 24 no tienen horas adicionales asignadas en este informe.

## Cierre e integraciones posteriores

| Momento | Evidencia |
| --- | --- |
| 17 de noviembre · cierre funcional | El commit [31c83d9](https://github.com/martatoscaperez/Procesos_MartaTosca/commit/31c83d9) incorpora el núcleo del incremento de convivencia. |
| 23 de noviembre · integración y comprobación | [PR 19](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/19): integración, 77 pruebas y 11 comprobaciones publicadas. |
| 23 de noviembre · acabado y perfiles | [PR 20](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/20): diseño coherente, ajustes personales, edición del hogar, avatares del chat y empates consecutivos. 92 pruebas y 18 comprobaciones publicadas. |
| 24 de noviembre · arquitectura | [PR 21](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/21): carpetas y dependencias por capas, repositorio de finanzas, planes de turnos y transporte centralizado. 99 pruebas y 18 comprobaciones publicadas. |

## Validación de la versión actual

La revisión del 24 de noviembre ejecutó **99 pruebas automatizadas**, sin fallos ni omisiones, incluidas las integraciones con PostgreSQL. La suite cubre usuarios, sesiones, permisos, persistencia, correo, Google, hogares, tareas, turnos, lotería, compra, normas, avisos, dinero, empates y fronteras de arquitectura.

Las **18 comprobaciones de Cloud Run** utilizaron dos sesiones independientes en un hogar de validación. Comprobaron archivos publicados, perfiles, conservación del correo y los permisos, edición administrativa del piso, foto del autor en el chat, aislamiento, normas, tareas propias, consulta de gastos, SSE, reintentos y lectura individual. Los datos temporales se restauraron.

El [CI](https://github.com/martatoscaperez/Procesos_MartaTosca/actions/runs/45370946950/job/138364755185) y el [despliegue de esa revisión](https://github.com/martatoscaperez/Procesos_MartaTosca/runs/138364752928) terminaron correctamente. El recorrido para repetir la comprobación está en [procesos](procesos.md#reproducir-la-comprobación-publicada).

## Límites aceptados

La entrega se centra en escritorio. Quedaron fuera el plano interactivo, la aceptación versionada de normas, la conversión automática de compra a gasto, el cierre mensual persistido del ranking, las sesiones distribuidas y un control general de versiones de todas las ediciones concurrentes. La lotería equilibra cantidades, no esfuerzo; las devoluciones no transfieren dinero.

## Retrospectiva

El mayor avance fue conectar funciones que se utilizan juntas: una cuenta pertenece a un piso, participa en tareas y gastos y comparte avisos con sus compañeros. Las comprobaciones con dos cuentas ayudaron a distinguir un permiso del hogar del rol global y a revisar el punto de mensajes sin leer.

El crecimiento rápido también dejó responsabilidades mezcladas. En la revisión del 24 separé el SQL de gastos, los planes de turnos y el transporte del navegador y añadí pruebas de arquitectura. Para la documentación, he mantenido separados el plan inicial, el resultado entregado y las revisiones posteriores: así no presento funciones descartadas como terminadas ni atribuyo al cierre del 17 cambios hechos después.
