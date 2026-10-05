# Procesos_MartaTosca
Proyecto de Ingeniería del Software curso 26-27
Bievenidos al Proyecto de Procesos 26-27

# Sprint 1: Desarrollar la arquitectura base del proyecto
El objetivo..

# Backend separado por capas

El backend utiliza JavaScript, Node.js y Express.
Node.js permite ejecutar JavaScript en el servidor y Express facilita
la definición de las rutas HTTP.

Se organiza en tres capas:

- servidor/api.js: recibe peticiones HTTP, llama a la lógica
  y devuelve respuestas JSON.
- servidor/logica.js: contiene los casos de uso y las reglas
  de la aplicación. Consulta la capa de datos y no depende de Express.
- servidor/datos.js: se encarga del acceso al almacenamiento.
  La conexión a una base de datos está pendiente.

Las llamadas siguen esta dirección: API → lógica → datos.
La API no accede directamente a la capa de datos.

### Ejecutar en local

1. Instalar las dependencias con `npm.cmd install`.
2. Arrancar el servidor con `npm.cmd start`.
3. Abrir http://localhost:3000/api/estado.

La ruta de estado recorre las tres capas y devuelve un mensaje
de funcionamiento junto con persistenciaConfigurada: false.
