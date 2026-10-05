# Kane 金

Gestión personal de dinero: cuentas (débito, crédito, inversión, ahorro), movimientos
(gasto, ingreso, traslado), presupuesto por categoría, gastos fijos automáticos, deudas y
respaldo (JSON o transferencia por QR entre dispositivos).

Los datos viven en Supabase (con RLS por usuario) y la app guarda una copia local en
LocalStorage para cargar al instante y funcionar sin conexión momentánea.

## Base de datos (Supabase)

Ejecuta los scripts de `supabase/` en el SQL Editor, **en este orden** y una sola vez:

1. `perfiles.sql` — perfil de usuario y trigger de registro.
2. `cuentas.sql` — multicuenta; migra los movimientos existentes a cuentas.
3. `kane.sql` — gastos fijos automáticos, presupuesto por monto, color e icono de categorías.

## Transferencia por QR

La cámara del navegador solo funciona en HTTPS (o `localhost`). En el móvil, abre Kane,
inicia sesión y usa **Respaldo → Recibir por QR** mientras el computador muestra
**Respaldo → Enviar a otro dispositivo (QR)**.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.33.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
