# Requisitos de HogarDu

Estado de la versión revisada el **24 de noviembre de 2026**. Los códigos RF y RNF de este documento identifican requisitos documentales; no sustituyen los PBI del seguimiento.

El estado **Implementado** significa que existe el comportamiento descrito y se señala su evidencia. Una prueba de lógica no acredita una pantalla o un proveedor externo: se distingue de la revisión visual, el CI y la comprobación publicada. Las funcionalidades se incorporaron en momentos distintos; [Sprint 1](sprint-1.md), [Sprint 2](sprint-2.md) y [log](log.md) explican esa evolución.

## Base del Sprint 1

### RF-01

**Registrar cuentas locales.** Pedir nombre, correo y contraseña; normalizar el correo, validar su dominio y evitar duplicados. Guardar un hash bcrypt y crear la cuenta pendiente, sin aceptar privilegios desde el registro.

- Estado: Implementado.
- Evidencia: [usuarios](../servidor/logica/logica.js), [pruebas de usuarios](../pruebas/usuarios.test.js) y [dominios](../pruebas/dominio.test.js).

### RF-02

**Iniciar y cerrar sesión.** Permitir acceso a cuentas activas, consultar la sesión al recargar y cerrarla invalidando la sesión del servidor. Rechazar cuentas pendientes o eliminadas y credenciales incorrectas.

- Estado: Implementado.
- Evidencia: [API](../servidor/api.js), [comunicación](../cliente/comunicacion/rest.js) y [pruebas HTTP](../pruebas/sesion.test.js).
- Límite: una sustitución o reinicio del proceso pierde las sesiones en memoria y puede exigir otro login.

### RF-03

**Proteger operaciones de usuarios.** Distinguir el rol global de usuario y administrador, restringir las consultas administrativas y aplicar las reglas de baja de cuentas.

- Estado: Implementado.
- Evidencia: [API](../servidor/api.js), [lógica de usuarios](../servidor/logica/logica.js) y [sesión y permisos](../pruebas/sesion.test.js).
- El rol global no concede administración sobre todos los pisos.

### RF-04

**Conservar los datos de las cuentas.** Guardar usuarios, estado, identidad Google y hashes en PostgreSQL. No devolver claves, hashes o códigos de confirmación en los datos públicos.

- Estado: Implementado.
- Evidencia: [repositorio de usuarios](../servidor/datos/datos-postgres.js), [integración PostgreSQL](../pruebas/postgres.test.js) y [pruebas de usuarios](../pruebas/usuarios.test.js).

### RF-05

**Confirmar el correo.** Enviar un enlace de confirmación, validar su código y caducidad y permitir reenvío acreditando la contraseña de la cuenta pendiente. No activar una cuenta solo porque se haya intentado enviar el mensaje.

- Estado: Implementado.
- Evidencia: [confirmación](../servidor/logica/confirmacion.js), [SMTP](../servidor/infraestructura/correo.js), [pruebas de correo](../pruebas/correo.test.js) y [PR 17](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/17).
- La recepción real depende de la configuración de correo; las pruebas simuladas no la demuestran por sí solas.

### RF-06

**Acceder con Google y vincular una identidad.** Validar identidad verificada y el flujo OAuth, incluidos `state`, `nonce` y PKCE. Evitar la vinculación automática por coincidencia de correo con una cuenta local existente.

- Estado: Implementado.
- Evidencia: [identidad](../servidor/logica/identidad-google.js), [OAuth](../servidor/infraestructura/oauth-google.js), [pruebas](../pruebas/google.test.js) y [PR 18](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/18).
- El botón y el flujo real requieren que Google esté configurado para el entorno.

## Funciones del piso y revisiones de entrega

### RF-07

**Crear y seleccionar pisos y utilizar invitaciones.** Crear un hogar con nombre, moneda y foto opcional, listar los propios y unirse mediante código o enlace. El código caduca a los siete días y solo se guarda su hash. Repetir una incorporación no duplica la membresía.

- Estado: Implementado.
- Evidencia: [hogares](../servidor/logica/hogares.js), [interfaz de pisos](../cliente/presentacion/hogares.js) y [pruebas](../pruebas/hogares.test.js).

### RF-08

**Aplicar los permisos del hogar.** Restringir su contenido a miembros y reservar al administrador la renovación de invitaciones y la edición del nombre y foto del grupo. Impedir una salida que deje al piso sin administrador.

- Estado: Implementado; edición de identidad revisada el 23 de noviembre.
- Evidencia: [servicio](../servidor/logica/hogares.js), [persistencia](../servidor/datos/datos-hogares.js), [perfil](../cliente/presentacion/perfil.js) y [pruebas HTTP](../pruebas/perfil-hogar-api.test.js).

### RF-09

**Navegar y consultar el resumen personal.** Mostrar accesos a las secciones del hogar, tareas pendientes propias, puntos del mes, suma de la parte personal de gastos, compañeros y próximos eventos.

- Estado: Implementado.
- Evidencia: [pantalla del piso](../cliente/piso.html), [presentación](../cliente/presentacion/piso.js) y revisión visual de escritorio.
- La tarjeta de gastos de Inicio suma participaciones; no representa la deuda neta tras devoluciones.

### RF-10

**Gestionar tareas pendientes.** Crear una tarea con título, fecha y responsable; consultar las propias o todas; editar título, fecha, frecuencia y responsable de una pendiente sin vencer y eliminarla cuando las reglas lo permiten.

- Estado: Implementado.
- Evidencia: [servicio de hogares](../servidor/logica/hogares.js), [presentación](../cliente/presentacion/piso.js) y [pruebas de edición](../pruebas/hogares.test.js).
- El alta individual exige fecha. En la edición de una tarea puntual puede dejarse sin fecha; una repetición necesita fecha de inicio. No se documenta una fecha opcional en todos los formularios.

### RF-11

**Crear turnos semanales y mensuales.** Mantener un orden de participantes, generar los turnos correspondientes y omitir miembros que ya no están. En meses cortos se usa el último día, recuperando el día elegido en meses posteriores.

- Estado: Implementado.
- Evidencia: [reglas de turnos](../servidor/logica/turnos.js), [pruebas de turnos](../pruebas/turnos.test.js) e [integración PostgreSQL](../pruebas/hogares-postgres.test.js).
- La actualización se realiza al consultar las tareas; no hay un trabajo programado diario independiente.

### RF-12

**Sortear tareas de forma equilibrada.** Admitir entre 1 y 200 tareas, participantes del piso y una fecha común opcional. Asignarlas con una diferencia máxima de una tarea por persona y mostrar el resultado agrupado. Reintentar la misma solicitud no duplica el reparto.

- Estado: Implementado.
- Evidencia: [lotería](../cliente/presentacion/loteria.js), [servicio](../servidor/logica/hogares.js) y [pruebas](../pruebas/hogares.test.js).
- El equilibrio mide cantidad dentro del sorteo, no dificultad ni trabajo acumulado.

### RF-13

**Completar tareas y comentar su foto.** Permitir que el responsable complete su tarea con foto opcional. Admitir JPG, PNG o WebP de hasta 600 KB, validando también el formato en el servidor. Ofrecer comentarios solo en tareas completadas con foto y permitir ocultar las hechas sin perder puntos.

- Estado: Implementado.
- Evidencia: [hogares](../servidor/logica/hogares.js), [imágenes](../servidor/logica/imagenes.js), [interfaz](../cliente/presentacion/piso.js) y [pruebas](../pruebas/hogares.test.js).
- La foto se adjunta al finalizar; no existe un alta posterior de foto desde la lista de hechas. La interfaz de hechas no ofrece el editor de pendientes.

### RF-14

**Calcular puntuación y representar el ranking mensual.** Sumar un punto por tarea hecha a tiempo y restar uno por vencida, sin nuevas penalizaciones diarias. Sin fecha se suma al completar y no hay retraso. Filtrar por el mes aplicable y mostrar hasta tres personas en el podio y el resto debajo.

- Estado: Implementado; criterio de empates corregido el 23 de noviembre.
- Evidencia: [cálculo de puntos](../servidor/logica/hogares.js), [ranking](../cliente/presentacion/ranking.js), [nueve pruebas](../pruebas/ranking.test.js) e [integración](../pruebas/hogares-postgres.test.js).
- Los empates se representan como `1.º, 1.º, 2.º`. No existe un cierre mensual guardado e inmutable.

### RF-15

**Compartir la lista de la compra.** Crear, renombrar y eliminar listas; añadir productos con cantidad opcional; marcar, desmarcar y borrar productos. Conservar los cambios por piso.

- Estado: Implementado.
- Evidencia: [compra](../cliente/presentacion/compra.js), [repositorio](../servidor/datos/datos-hogares.js) y [pruebas](../pruebas/hogares.test.js).
- No convierte automáticamente una compra en un gasto.

### RF-16

**Registrar gastos y consultar cuentas pendientes.** Guardar concepto, fecha, pagador, importe y reparto igual o personalizado; editar o eliminar movimientos; calcular deudas compensadas y registrar devoluciones parciales o completas. El filtro de cuentas propias muestra las deudas en las que la persona es deudora.

- Estado: Implementado.
- Evidencia: [finanzas](../servidor/logica/finanzas.js), [datos de finanzas](../servidor/datos/datos-finanzas.js), [pruebas de dinero](../pruebas/finanzas.test.js) y [transacciones PostgreSQL](../pruebas/hogares-postgres.test.js).
- Los importes se calculan en céntimos y el reparto debe sumar el total. Una devolución es un registro; no transfiere dinero.

### RF-17

**Coordinar el calendario.** Consultar el mes, navegar entre meses y registrar eventos con título, fecha, hora opcional y descripción. Permitir al autor editar o eliminar su evento y mostrar los próximos en Inicio.

- Estado: Implementado.
- Evidencia: [calendario](../cliente/presentacion/calendario.js), [servicio](../servidor/logica/hogares.js) y [pruebas de autoría](../pruebas/hogares.test.js).

### RF-18

**Consultar y administrar las normas.** Todos los miembros pueden leerlas. Solo el administrador del piso puede añadir, editar o borrar una norma, con título obligatorio y descripción opcional.

- Estado: Implementado.
- Evidencia: [normas](../cliente/presentacion/normas.js), [servicio](../servidor/logica/hogares.js), [persistencia](../servidor/datos/datos-hogares.js) y [pruebas](../pruebas/hogares.test.js).
- No hay aceptación individual ni historial versionado de las normas.

### RF-19

**Compartir avisos con actualización inmediata y lectura individual.** Publicar mensajes, consultar su autor, fecha y foto personal, y permitir a cada persona editar o borrar los suyos. Mostrar un punto verde por mensajes ajenos sin leer y retirarlo al leer el chat. Recuperar el historial tras una reconexión.

- Estado: Implementado; fotos del autor revisadas el 23 de noviembre.
- Evidencia: [avisos](../cliente/presentacion/avisos.js), [SSE](../servidor/datos/avisos-en-vivo.js), [pruebas del canal](../pruebas/avisos-en-vivo.test.js), [permisos y lectura](../pruebas/hogares.test.js) y [comprobador publicado](../scripts/comprobar-despliegue.js).
- La lectura es por usuario y piso, no por pestaña. Las ediciones y los mensajes propios no generan un nuevo aviso de lectura para su autor.

### RF-20

**Editar el perfil personal.** Cambiar el nombre y añadir, sustituir o quitar la foto propia. Consultar el correo como texto no editable. Mantener el correo, la contraseña, la identidad Google y los roles al guardar estos cambios. Mostrar la foto en los avatares personales, compañeros y chat; usar la inicial cuando no hay foto.

- Estado: Implementado en la revisión del 23 de noviembre.
- Evidencia: [cuenta](../cliente/presentacion/cuenta.js), [servicio de usuarios](../servidor/logica/logica.js), [pruebas](../pruebas/usuarios.test.js) y [sesión HTTP](../pruebas/sesion.test.js).
- El formulario personal edita nombre y foto; no es un formulario para cambiar correo o contraseña.

## Matriz de permisos del piso

| Operación | Miembro | Administrador del piso |
| --- | --- | --- |
| Consultar contenido del piso | Sí | Sí |
| Gestionar compra y gastos compartidos | Sí | Sí |
| Gestionar pendientes sin vencer según las reglas de tareas | Sí | Sí |
| Completar la tarea de otra persona | No | No |
| Editar o borrar avisos y eventos de otro autor | No | No |
| Leer normas | Sí | Sí |
| Añadir, editar o borrar normas | No | Sí |
| Cambiar nombre y foto del piso o renovar invitación | No | Sí |
| Editar el perfil personal de otra cuenta | No | No |

Esta matriz se refiere a membresías del hogar. Las operaciones globales de administración de usuarios tienen sus propias reglas. El nombre de una cuenta, por ejemplo «Admin», no determina su permiso dentro de un piso.

## Calidad y límites

| Código | Criterio comprobable | Evidencia y alcance |
| --- | --- | --- |
| RNF-01 | Separación por capas y dependencias explícitas. | [Arquitectura](arquitectura.md) y [cuatro pruebas de fronteras](../pruebas/arquitectura.test.js). |
| RNF-02 | Persistencia y coherencia al guardar operaciones compartidas. | Repositorios PostgreSQL, transacciones de gastos y sorteos y pruebas con tablas temporales. No hay control general de versión para todas las ediciones concurrentes. |
| RNF-03 | Permisos aplicados en el servidor y exclusión de secretos en respuestas y logs. | Pruebas de sesión, usuarios, hogares y [actividad](../pruebas/actividad.test.js). No equivale a una auditoría completa de seguridad. |
| RNF-04 | Reintentos controlados en operaciones identificadas. | Pruebas de creación, membresías, gastos, sorteos y avisos. No se extiende automáticamente a cualquier operación futura. |
| RNF-05 | Actualización y recuperación del chat. | SSE, secuencias de lectura y comprobación con dos sesiones; sin garantía contractual de latencia. |
| RNF-06 | Entrega verificable. | CI con PostgreSQL temporal, despliegue en Cloud Run, 99 pruebas y 18 comprobaciones publicadas en la revisión del 24 de noviembre. |
| RNF-07 | Interfaz coherente para ordenador. | Revisión visual de escritorio. No se entrega ni se acredita una adaptación completa a móvil. |

## Fuera del alcance entregado

No se incluyen plano interactivo o navegación por habitaciones, aceptación versionada de normas, conversión automática de compra a gasto, transferencias bancarias, cierre mensual persistido del ranking, sesiones distribuidas ni control general de versiones para todas las escrituras. Tampoco se declara una aplicación móvil o una validación de carga.

Los modelos y rutas propuestos en versiones iniciales del README son antecedentes de diseño. Este documento y el código actual delimitan lo implementado; una función no se considera hecha solo por figurar en una propuesta antigua.
