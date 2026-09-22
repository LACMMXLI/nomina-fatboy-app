# Nómina interna Fatboy

Aplicación web full stack para capturar, calcular, autorizar, pagar, consultar e imprimir la nómina interna de Fatboy. Los recibos son comprobantes internos y no sustituyen CFDI ni un sistema contable.

## Funciones

- Usuarios con roles `SUPER_ADMIN`, `ADMINISTRADOR`, `ENCARGADO` y `CONSULTA`.
- Restricción real por sucursal en servidor.
- Empleados, historial salarial, sucursales, puestos y conceptos editables.
- Periodos semanales o personalizados.
- Captura individual y captura rápida con guardado de borradores.
- Cálculo fijo o prorrateado mediante Decimal, pagos mixtos y control de totales negativos.
- Finalización transaccional, folios, recibos, PDF, impresión 80/58 mm y validación por QR.
- Pago, cancelación, reemplazo versionado y auditoría.
- Dashboard, filtros, reportes y exportaciones Excel.
- Logotipo configurable, tema claro/oscuro y almacenamiento local protegido.

## Tecnologías

Next.js App Router, React, TypeScript estricto, PostgreSQL, Prisma 7, Auth.js/NextAuth, Tailwind CSS, componentes shadcn/Radix, React Hook Form, Zod, TanStack Table, Decimal.js, date-fns, Recharts, ExcelJS, React PDF, Vitest y Playwright.

## Requisitos

- Node.js 24 o una versión compatible con Next.js 16 y Prisma 7.
- npm.
- PostgreSQL 18 o compatible.
- Para contenedores: Docker con Compose.
- Para respaldos locales: `pg_dump` y `pg_restore` en `PATH`.

## Configuración

```powershell
Copy-Item .env.example .env
npm install
```

Variables principales:

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión TCP a PostgreSQL |
| `AUTH_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `NEXTAUTH_URL` / `APP_URL` | URL pública de la aplicación |
| `UPLOAD_DIR` | Directorio persistente de archivos |
| `MAX_UPLOAD_SIZE` | Máximo por archivo en bytes |
| `TIMEZONE` | Inicialmente `America/Tijuana` |
| `BUSINESS_NAME` | Inicialmente `Fatboy` |

No utilices los valores de desarrollo de `.env` en producción.

## PostgreSQL local

Crea una base y usuario compatibles con `DATABASE_URL`, y después:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:create-admin -- --username admin --email admin@tudominio.com --password "una-contraseña-fuerte-min-12" --firstName Nombre --lastName Apellido
npm run dev
```

El seed es idempotente: crea Venecia, San Marcos, Américas, puestos, conceptos y configuración general. No crea usuarios ni empleados ficticios. El primer administrador (y cualquier usuario creado directamente por terminal en lugar de la interfaz) se da de alta con `npm run db:create-admin` (si falta un argumento obligatorio, el script imprime el uso correcto); es idempotente por `username`, así que también sirve para restablecer la contraseña de ese usuario.

Para crear una migración durante desarrollo:

```powershell
npm run db:migrate:dev -- --name descripcion
```

## Docker Compose

Define como mínimo `AUTH_SECRET` en `.env`, y ejecuta:

```bash
docker compose up --build -d
docker compose ps
```

El contenedor espera PostgreSQL, aplica migraciones, ejecuta el seed idempotente (solo datos de referencia) y arranca Next.js en modo productivo. Los datos de PostgreSQL, archivos y respaldos utilizan volúmenes persistentes.

Crea el primer administrador directamente dentro del contenedor (no queda ninguna contraseña por defecto en el repo ni en las variables de entorno):

```bash
docker compose exec app npm run db:create-admin -- --username admin --email admin@tudominio.com --password "una-contraseña-fuerte-min-12" --firstName Nombre --lastName Apellido
```

Healthcheck:

```text
GET /api/health
```

## Pruebas y compilación

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Las pruebas unitarias no requieren base. Para integración, crea una base aislada, aplica las migraciones y define `TEST_DATABASE_URL`. Para Playwright define `E2E_DATABASE_READY=true` únicamente cuando la base migrada y el seed estén disponibles:

```powershell
npm run test:e2e
```

Nunca apuntes pruebas de integración a la base productiva.

## Flujo operativo

1. Inicia sesión con el administrador inicial.
2. Revisa las tres sucursales y crea un empleado con sueldo semanal.
3. Crea y abre un periodo.
4. Entra a captura individual o rápida; registra ingresos y descuentos.
5. Guarda el borrador y revisa el detalle.
6. Finaliza con confirmación explícita para generar folios y recibo.
7. Imprime, descarga PDF o valida el token del recibo.
8. Registra el pago.
9. Si existe un error, cancela o crea un reemplazo; el original permanece en historial.
10. Consulta dashboard, reportes, Excel y auditoría.

## Impresión

El recibo tiene estilos de impresión sin navegación ni fondos. El tamaño predeterminado es 80 mm y puede cambiarse a 58 mm desde la preferencia/configuración de impresión. Los PDF se generan en servidor en tamaño carta y conservan el snapshot histórico.

## Respaldos

```powershell
npm run db:backup
npm run db:backups
npm run db:restore -- nomina-fatboy-fecha.dump --confirm
```

La restauración exige confirmación por terminal y solo acepta archivos del directorio `backups`. Verifica regularmente los respaldos en un entorno aislado.

## Coolify

1. Crea un recurso desde este repositorio usando el `Dockerfile`.
2. Configura un PostgreSQL persistente y `DATABASE_URL`.
3. Agrega todas las variables de `.env.example` con secretos reales (genera `AUTH_SECRET` nuevo, nunca reutilices el de desarrollo).
4. Monta volúmenes persistentes para `/app/uploads` y `/app/backups`.
5. Expón el puerto `3000` y configura el dominio HTTPS.
6. Usa `/api/health` como healthcheck.
7. Despliega; el entrypoint aplica migraciones y el seed de referencia antes de arrancar.
8. Abre una terminal al contenedor desde Coolify (o `docker exec`) y crea el primer administrador:
   ```bash
   npm run db:create-admin -- --username admin --email admin@tudominio.com --password "una-contraseña-fuerte-min-12" --firstName Nombre --lastName Apellido
   ```

Las cookies `Secure` se activan al usar HTTPS en producción. No publiques el servicio sin un `AUTH_SECRET` propio y sin haber creado el administrador con una contraseña que solo tú conozcas.

## Estructura

```text
src/app/        rutas, páginas, Server Actions y endpoints
src/components/ interfaz, formularios, tablas y recibos
src/lib/        Prisma, cálculo, formato, permisos, archivos y documentos
src/server/     autenticación, validaciones y transacciones de nómina
prisma/         esquema, migraciones y seed
tests/          pruebas unitarias, integración y Playwright
scripts/        respaldo, listado y restauración
```

El cálculo monetario definitivo vive en `src/lib/payroll-calculator.ts`; los componentes cliente solo muestran una vista previa.
