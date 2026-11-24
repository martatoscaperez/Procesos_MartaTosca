# Documentación de HogarDu

HogarDu es una aplicación web para organizar la convivencia en un piso compartido. Reúne tareas y turnos, compra, gastos, calendario, normas, avisos y un ranking mensual. Cada persona accede con su cuenta y solo puede consultar los pisos a los que pertenece.

Esta documentación describe la versión comprobada el **24 de noviembre de 2026**. El cierre del Sprint 2 fue el 17 de noviembre; los ajustes de interfaz, perfiles y separación de capas del 23 y 24 de noviembre se identifican como revisiones posteriores.

| Documento | Qué explica |
| --- | --- |
| [Requisitos](requisitos.md) | Funciones implementadas, permisos, límites y pruebas que las respaldan. |
| [Arquitectura](arquitectura.md) | Capas, dependencias, almacenamiento y despliegue. |
| [Decisiones](decisiones.md) | Decisiones de diseño, sus motivos y sus consecuencias. |
| [Procesos](procesos.md) | Recorridos de uso y forma de desarrollar, probar y publicar los cambios. |
| [Registro de cambios](log.md) | Evolución del proyecto con fechas y referencias a Git. |
| [Sprint 1](sprint-1.md) | Base técnica y funcional que quedó cerrada el 3 de noviembre. |
| [Sprint 2](sprint-2.md) | Hitos, seguimiento, dedicación comunicada y validación del incremento. |

- [Abrir la aplicación publicada](https://procesos-martatosca-569228981488.europe-west1.run.app/).
- [Repositorio de HogarDu](https://github.com/martatoscaperez/Procesos_MartaTosca).
- [Instalación, variables de entorno y comandos](../README.md).
- [Pruebas automatizadas](../pruebas/).
- [Comprobador de la aplicación desplegada](../scripts/comprobar-despliegue.js).

La última revisión funcional completa superó **99 pruebas automatizadas**, incluida PostgreSQL, y **18 comprobaciones sobre Cloud Run con dos sesiones independientes**. Estos resultados acreditan los recorridos comprobados; no sustituyen una prueba de carga ni una evaluación para móviles. La versión entregada está orientada a ordenador.

Las contraseñas, cookies, cadenas de conexión y claves de proveedores no forman parte de esta documentación. Los identificadores RF de estos documentos organizan los requisitos de HogarDu; no son identificadores de DoneTonic. Los PBI del seguimiento se relacionan por separado en el [Sprint 2](sprint-2.md).
