import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_DATABASE_READY !== "true", "Requiere PostgreSQL migrado y seed.");

test("login y navegación del flujo crítico", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);
  const employeeNumber = `PW${suffix}`;
  const periodName = `Semana Playwright ${suffix}`;
  const start = new Date(Date.UTC(2030, 0, 1) + (Number(suffix) % 20_000) * 86_400_000);
  const iso = (offset: number) => new Date(start.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/login");
  await page.getByLabel("Correo electrónico o usuario").fill(process.env.INITIAL_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Contraseña").fill(process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe-123456");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
  await page.getByRole("link", { name: "Inicio" }).click();
  await page.getByRole("link", { name: "Empleados" }).click();
  await expect(page.getByRole("heading", { name: "Empleados" })).toBeVisible();
  await page.getByRole("link", { name: "Nuevo empleado" }).click();
  await page.getByLabel("Número de empleado").fill(employeeNumber);
  await page.getByLabel("Nombre").fill("Prueba");
  await page.getByLabel("Apellido paterno").fill("Playwright");
  await page.getByLabel("Sucursal").selectOption({ label: "Venecia" });
  await page.getByLabel("Puesto").selectOption({ label: "Caja" });
  await page.getByLabel("Fecha de ingreso").fill("2026-07-01");
  await page.getByLabel("Sueldo base").fill("3500");
  await page.getByRole("button", { name: "Guardar empleado" }).click();
  await expect(page.getByRole("heading", { name: "Prueba Playwright" })).toBeVisible();

  await page.getByRole("link", { name: "Periodos" }).click();
  await page.getByRole("link", { name: "Crear periodo" }).first().click();
  await page.getByLabel("Nombre del periodo").fill(periodName);
  await page.getByLabel("Fecha inicial").fill(iso(0));
  await page.getByLabel("Fecha final").fill(iso(6));
  await page.getByLabel("Fecha de pago").fill(iso(7));
  await page.getByLabel("Sucursal").selectOption({ label: "Venecia" });
  await page.getByRole("button", { name: "Crear y abrir periodo" }).click();
  await expect(page.getByRole("heading", { name: periodName })).toBeVisible();

  const employeeRow = page.getByRole("row").filter({ hasText: employeeNumber });
  await employeeRow.getByRole("link", { name: "Capturar" }).click();
  await page.getByLabel("Bono").fill("500");
  await page.getByLabel("Adelantos").fill("300");
  await page.getByLabel("Consumos").fill("100");
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await expect(page.getByText("NOM-", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("$3,600.00", { exact: false }).first()).toBeVisible();

  await page.getByLabel("Confirmo que revisé los importes.").check();
  await page.getByRole("button", { name: "Finalizar y generar recibo" }).click();
  await expect(page.getByText("Finalizado", { exact: true }).first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Descargar PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/nomina-.*\.pdf/);

  await page.getByPlaceholder("Efectivo").fill("3600");
  await page.getByPlaceholder("Recibido por").fill("Prueba Playwright");
  await page.getByRole("button", { name: "Marcar como pagada" }).click();
  await expect(page.getByText("Pagado", { exact: true }).first()).toBeVisible();

  await page.getByRole("link", { name: "Historial" }).click();
  await expect(page.getByRole("heading", { name: "Historial de nómina" })).toBeVisible();
  await page.getByPlaceholder("Folio, empleado o número…").fill(employeeNumber);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("row").filter({ hasText: employeeNumber })).toBeVisible();

});

test("edita el perfil y revoca la sesión al cambiar contraseña", async ({ page }) => {
  const currentPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe-123456";
  await page.goto("/login");
  await page.getByLabel("Correo electrónico o usuario").fill(process.env.INITIAL_ADMIN_USERNAME ?? "admin");
  await page.getByLabel("Contraseña").fill(currentPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await page.getByRole("button", { name: "Guardar información" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();

  await page.getByLabel("Tu contraseña actual").fill(currentPassword);
  await page.getByLabel("Nueva contraseña", { exact: true }).fill(currentPassword);
  await page.getByLabel("Confirmar nueva contraseña").fill(currentPassword);
  await page.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
});
