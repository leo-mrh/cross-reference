# Daimler Buses México Cross Reference

Este proyecto contiene el sistema automatizado de cruce de referencias para Daimler Buses México.

## Requisitos Previos

- **Node.js** v18+
- **Angular CLI** v18+
- **SQL Server** (acceso a instancia del Data Lake corporativo de Daimler)

## Configuración de la Base de Datos

1. Asegúrate de tener acceso a la instancia de SQL Server del Data Lake corporativo de Daimler.
2. Crea un archivo `.env` en la raíz de `daimler-buses-back` con las siguientes variables:
   ```env
   DB_HOST=
   DB_PORT=
   DB_USER=
   DB_PASS=
   DB_NAME=
   DB_SCHEMA=

   JWT_SECRET=CHANGE_ME__GENERATE_A_LONG_RANDOM_SECRET
   JWT_EXPIRES_IN=8h

## Acceso al Sistema

Para entrar al sistema, utiliza las siguientes credenciales de prueba:

- **Acceso como Administrador:**
  - **Email:** `admin@daimlertruck.com`
  - **Contraseña:** `password123`

- **Acceso como Usuario:**
  - **Email:** `user@daimlertruck.com`
  - **Contraseña:** `password123`

## Ejecución del Backend

El servidor backend está construido con NestJS y se encuentra en la carpeta `daimler-buses-back`.

1. Entra a la carpeta:
   ```bash
   cd daimler-buses-back
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Inicia el servidor en modo desarrollo:
   ```bash
   npm run start:dev
   ```

## Ejecución del Frontend

1. Desde la raíz del proyecto, instala las dependencias:
   ```bash
   npm install
   ```
2. Inicia el servidor de Angular:
   ```bash
   ng serve
   ```
3. Accede a `http://localhost:4200/`
# cross-reference
