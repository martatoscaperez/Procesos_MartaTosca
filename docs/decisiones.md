# Decisiones de diseño de HogarDu

Estado revisado el **24 de noviembre de 2026**. Recojo las decisiones que explican el comportamiento entregado, junto con las alternativas que descarté y el coste de cada elección.

## D1 · Separar las capas e inyectar repositorios

La interfaz representa datos, comunicación gestiona HTTP y SSE, la API atiende peticiones, la lógica aplica reglas y los repositorios resuelven persistencia. Los servicios reciben el repositorio por parámetro.

**Motivo:** facilita probar las reglas sin levantar Express o PostgreSQL y evita duplicarlas entre navegador y servidor.

**Alternativa y coste:** concentrar todo en un módulo reduce archivos al principio, pero dificulta modificar y probar cada responsabilidad. La separación requiere más módulos y un punto de ensamblado explícito.

**Evidencia:** [arquitectura](arquitectura.md), [pruebas de fronteras](../pruebas/arquitectura.test.js) y [PR 21](https://github.com/martatoscaperez/Procesos_MartaTosca/pull/21).

## D2 · PostgreSQL para persistencia y memoria para pruebas aisladas

Las cuentas y los datos del piso se conservan en PostgreSQL. Los adaptadores en memoria permiten probar reglas sin depender de una base externa; las pruebas de integración utilizan PostgreSQL temporal.

**Motivo:** las claves, relaciones y transacciones encajan con cuentas, membresías y operaciones compartidas.

**Alternativa y coste:** almacenar todo únicamente en memoria perdería información al reiniciar. Usar un almacén documental también sería posible, pero exigiría otro diseño. PostgreSQL introduce configuración, migraciones y comprobaciones de conexión.

**Evidencia:** [repositorios](../servidor/datos/), [persistencia de usuarios](../pruebas/postgres.test.js) y [persistencia del piso](../pruebas/hogares-postgres.test.js).

## D3 · Diferenciar el rol global del rol en un piso

Una cuenta puede administrar un piso y ser miembro de otro. El permiso sobre normas, invitaciones y datos del hogar depende de la membresía de ese piso, no del rol global de la cuenta.

**Motivo:** un administrador de usuarios no debe obtener automáticamente acceso administrativo a cualquier hogar.

**Alternativa y coste:** un único rol sería más sencillo, pero no representaría esta diferencia. Hay que comprobar identidad, pertenencia y permiso en cada operación protegida. Ocultar un botón no sustituye la comprobación del servidor.

**Evidencia:** [servicio de hogares](../servidor/logica/hogares.js), [repositorio](../servidor/datos/datos-hogares.js) y [prueba HTTP del perfil del piso](../pruebas/perfil-hogar-api.test.js).

## D4 · Invitaciones con caducidad y hash

Se comparte un código de invitación válido durante siete días. La base conserva su hash; el administrador puede renovarlo e invalidar el anterior. Repetir una incorporación no duplica la membresía.

**Motivo:** permitir entrar al piso sin publicar su contenido ni almacenar el código en claro.

**Alternativa y coste:** un código permanente sería más cómodo, pero seguiría dando acceso tras compartirse fuera del grupo. La caducidad obliga a renovar y volver a distribuir la invitación cuando sea necesario.

**Evidencia:** [hogares](../servidor/logica/hogares.js) y [pruebas de invitaciones](../pruebas/hogares.test.js).

## D5 · Repartir la lotería por número de tareas

El sorteo mezcla tareas y participantes y reparte de manera que la diferencia máxima sea una tarea. La solicitud identifica el reparto para que un reintento no lo cambie ni duplique las asignaciones. La fecha común es opcional.

**Motivo:** evitar repartos como cinco tareas para una persona y una para otra en el mismo sorteo.

**Alternativa y coste:** un reparto independiente por tarea puede ser aleatorio pero muy desigual. Ponderar dificultad o trabajo acumulado sería más completo, pero no hay pesos definidos en esta versión. El equilibrio garantizado es de cantidad dentro del sorteo, no de esfuerzo ni de carga histórica.

**Evidencia:** [sortearTareas](../servidor/logica/hogares.js), [lotería](../cliente/presentacion/loteria.js) y [pruebas de hogares](../pruebas/hogares.test.js).

## D6 · Calcular puntos desde las tareas

Una tarea hecha a tiempo suma un punto. Una tarea vencida resta uno, aunque se complete después; no sigue restando cada día. Sin fecha no hay penalización y se suma un punto al completarla. El mes se obtiene de su fecha límite o, si no existe, de su finalización.

**Motivo:** derivar la puntuación del estado real evita duplicar puntos al repetir una petición. Ocultar una tarea hecha no borra sus puntos.

**Alternativa y coste:** un registro de movimientos de puntos o un cierre mensual persistido daría más trazabilidad histórica, pero requeriría nuevas reglas de corrección. Esta versión recalcula el ranking y no conserva una fotografía inmutable del cierre de cada mes.

**Evidencia:** [cálculo de tareas](../servidor/logica/hogares.js) y [pruebas de PostgreSQL](../pruebas/hogares-postgres.test.js).

## D7 · Compartir puestos sin saltos en los empates

Dos personas con la misma puntuación ocupan el mismo puesto. El siguiente grupo avanza una posición: `1.º, 1.º, 2.º`. El podio representa hasta tres personas; el resto aparece debajo conservando su puesto, aunque también esté empatado.

**Motivo:** es el criterio elegido para que la siguiente persona a dos primeros no aparezca como tercera. Los escalones, medallas y textos usan la misma posición.

**Alternativa y coste:** el ranking de competición `1.º, 1.º, 3.º` también es una convención válida, pero no es la usada en HogarDu. Mostrar solo tres personas puede repartir un grupo empatado entre podio y lista; la etiqueta de empate y la explicación aclaran ese límite visual.

**Evidencia:** [representación del ranking](../cliente/presentacion/ranking.js) y [nueve casos de prueba](../pruebas/ranking.test.js).

## D8 · Usar céntimos y compensar deudas

Los importes se calculan como enteros en céntimos. El reparto puede ser igual o personalizado y debe sumar el total. Los céntimos sobrantes del reparto igual se distribuyen de uno en uno. Los movimientos permiten calcular quién debe a quién y registrar devoluciones parciales o completas.

**Motivo:** evitar diferencias de redondeo y que cada devolución tenga un efecto coherente sobre la deuda pendiente.

**Alternativa y coste:** usar decimales binarios directamente puede producir diferencias de un céntimo. Mantener saldos editables añadiría otra fuente de verdad. La compensación reduce pagos necesarios, pero puede proponer una deuda neta distinta de la suma de relaciones originales. No se realizan transferencias bancarias.

La tarjeta de Inicio «Tus gastos pendientes» muestra la suma de la parte personal de los gastos compartidos, según el criterio pedido para esa pantalla. **No equivale al saldo neto después de devoluciones**; ese dato se consulta en Cuentas pendientes.

**Evidencia:** [servicio de finanzas](../servidor/logica/finanzas.js), [repositorio](../servidor/datos/datos-finanzas.js) y [pruebas](../pruebas/finanzas.test.js).

## D9 · Adjuntar la foto al finalizar y comentar la foto

La foto de una tarea es opcional y se incorpora al marcarla como hecha. No hay un botón posterior para añadirla. Los comentarios solo están disponibles si la tarea tiene foto. Se admiten JPG, PNG y WebP de hasta 600 KB.

**Motivo:** los comentarios están pensados para el resultado mostrado, no como un chat de cualquier tarea.

**Alternativa y coste:** permitir adjuntar fotos en cualquier momento sería más flexible, pero cambiaría el recorrido acordado. Guardarlas codificadas en PostgreSQL simplifica esta entrega y sus copias de datos, aunque aumenta el tamaño de la base y las respuestas; no se utiliza un servicio de objetos independiente.

La foto personal y la del piso son datos distintos. Cada persona edita su nombre y foto; solo el administrador del hogar cambia el nombre y la foto del grupo. El correo no se edita desde el perfil.

**Evidencia:** [validación de imágenes](../servidor/logica/imagenes.js), [cuenta](../cliente/presentacion/cuenta.js), [perfil del piso](../cliente/presentacion/perfil.js) y [pruebas de usuarios](../pruebas/usuarios.test.js).

## D10 · SSE para avisos y lectura individual

HTTP guarda los mensajes y SSE comunica que hay cambios. Después de la señal, el cliente consulta el historial con su sesión. La lectura se guarda por usuario y piso mediante una secuencia, y el punto verde solo indica avisos ajenos sin leer.

**Motivo:** actualizar el chat sin recargar y sin marcar como leído un mensaje que aún no se ha cargado.

**Alternativa y coste:** el sondeo periódico introduce retraso y más consultas; WebSocket permitiría comunicación bidireccional, que no es necesaria aquí. SSE requiere reconexión, límites de vida de la conexión y revisión de pertenencia al volver a conectarse. El canal se renueva cada cuatro minutos y `LISTEN/NOTIFY` propaga señales entre procesos.

**Evidencia:** [transporte del cliente](../cliente/comunicacion/rest.js), [avisos](../cliente/presentacion/avisos.js), [canal](../servidor/datos/avisos-en-vivo.js) y [pruebas SSE](../pruebas/avisos-en-vivo.test.js).

## D11 · Sesiones en memoria y una instancia

La identidad de sesión se guarda mediante `express-session` en memoria del proceso, con cookie HttpOnly, SameSite Lax y una hora de duración. La cuenta se vuelve a consultar para rechazar estados no activos. El despliegue actual limita la aplicación a una instancia.

**Motivo:** mantener una solución sencilla para el alcance entregado y comprobar permisos con cuentas reales.

**Alternativa y coste:** persistir sesiones en PostgreSQL o Redis permitiría conservarlas al reiniciar y facilitaría el escalado, pero no está implementado. Al reiniciar o sustituir la instancia puede ser necesario volver a entrar. La configuración actual no activa la marca `Secure` de la cookie; el servicio público utiliza HTTPS. No se presenta este diseño como una solución de sesión distribuida.

**Evidencia:** [configuración de sesión](../servidor/api.js), [pruebas HTTP](../pruebas/sesion.test.js) y [límites de arquitectura](arquitectura.md#avisos-y-límites-operativos).

## D12 · Entregar una aplicación de escritorio y mantener la trazabilidad

La versión de entrega se centra en ordenador. He mantenido fuera del alcance el plano interactivo, la aceptación versionada de normas, la conversión automática de compra a gasto y el cierre mensual guardado del ranking.

**Motivo:** hacer coincidir la documentación con lo que realmente funciona. El planteamiento inicial de navegación por zonas se sustituyó por secciones del piso.

**Alternativa y coste:** ampliar todas esas funciones y la versión móvil requeriría más implementación y validación. No se consideran hechas por aparecer en un plan antiguo. Las mejoras del 23 y 24 de noviembre se registran después del cierre del Sprint 2, sin cambiar su fecha ni inventar horas adicionales.

**Evidencia:** [requisitos y exclusiones](requisitos.md), [Sprint 2](sprint-2.md) y [registro de cambios](log.md).
