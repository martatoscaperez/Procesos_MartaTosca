# Registro de cambios de HogarDu

Este registro resume cambios relevantes. Las fechas de código proceden de Git; el cierre de los sprints y las horas de seguimiento se documentan por separado en sus informes. La versión aquí descrita se revisó el **24 de noviembre de 2026**.

| Fecha | Cambio comprobable | Referencia |
| --- | --- | --- |
| 30 de septiembre de 2026 | Inicio del repositorio. | [3fbd23a](https://github.com/martatoscaperez/Procesos_MartaTosca/commit/3fbd23a). |
| 5 y 6 de octubre de 2026 | Primera separación API, lógica y datos; usuarios en memoria, pruebas, CI y publicación inicial. | [PR 1](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/1) y [PR 2](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/2). |
| 12 de octubre de 2026 | Interfaz, registro local, contraseña con bcrypt, sesión, logout y rutas protegidas. | [PR 6](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/6), [PR 7](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/7), [PR 9](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/9) y [PR 10](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/10). |
| 13 de octubre de 2026 | Persistencia PostgreSQL, administrador, permisos y registro de actividad. | [PR 11](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/11), [PR 12](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/12) y [PR 13](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/13). |
| 3 de noviembre de 2026 | Publicación principal en Google Cloud, confirmación por correo y acceso con Google. Cierre del Sprint 1. | [PR 16](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/16), [PR 17](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/17), [PR 18](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/18) y [Sprint 1](sprint-1.md). |
| 4 de noviembre de 2026 | Inicio del Sprint 2, según las fechas confirmadas del seguimiento. | [Sprint 2](sprint-2.md). |
| 17 de noviembre de 2026 | Incremento funcional de pisos, tareas, compra, gastos y convivencia. Cierre del Sprint 2. | [31c83d9](https://github.com/martatoscaperez/Procesos_MartaTosca/commit/31c83d9). |
| 23 de noviembre de 2026 | Integración y comprobación del incremento publicado: 77 pruebas automatizadas y 11 comprobaciones con dos sesiones. | [PR 19](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/19). |
| 23 de noviembre de 2026 | Diseño unificado, ajustes personales, edición del nombre y foto del piso, fotos en el chat y corrección de empates. La suite alcanzó 92 pruebas y el comprobador publicado, 18 recorridos. | [PR 20](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/20). |
| 24 de noviembre de 2026 | Carpetas por capas, repositorios de gastos separados de la lógica, planes de turnos en negocio y transporte del cliente centralizado. 99 pruebas y 18 comprobaciones publicadas correctas. | [PR 21](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/21), [arquitectura](arquitectura.md). |
| 24 de noviembre de 2026 | Preparación de los ocho documentos de referencia de HogarDu en `docs`, con enlaces al código y a sus evidencias. | [Índice de documentación](index.md). |

La revisión publicada de la separación de capas corresponde al commit [ab2611e](https://github.com/martatoscaperez/Procesos_MartaTosca/commit/ab2611e6a816d6792d86b0f4750ff38ea0dbf916). El [CI de esa revisión](https://github.com/martatoscaperez/Procesos_MartaTosca/actions/runs/45370946950/job/138364755185) y el [despliegue](https://github.com/martatoscaperez/Procesos_MartaTosca/runs/138364752928) finalizaron correctamente.

Las correcciones posteriores al 17 de noviembre no se presentan como trabajo terminado antes del cierre. La memoria académica de Overleaf es un documento distinto: crear esta carpeta no implica que su contenido ya se haya incorporado allí.
