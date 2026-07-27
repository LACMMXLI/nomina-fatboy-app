-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMINISTRADOR', 'ENCARGADO', 'CONSULTA');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "PrintSize" AS ENUM ('MM58', 'MM80', 'LETTER', 'HALF_LETTER');

-- CreateEnum
CREATE TYPE "SalaryPeriodicity" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "CalculationMode" AS ENUM ('FIXED', 'PRORATED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_REVIEW', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ConceptType" AS ENUM ('INCOME', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'FINALIZED', 'PAID', 'CANCELLED', 'REPLACED');

-- CreateEnum
CREATE TYPE "FolioType" AS ENUM ('PERIOD', 'PAYROLL', 'RECEIPT');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('LOGO', 'EMPLOYEE_PHOTO', 'SIGNATURE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" UUID NOT NULL,
    "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
    "printSize" "PrintSize" NOT NULL DEFAULT 'MM80',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserBranch" (
    "userId" UUID NOT NULL,
    "branchId" UUID NOT NULL,

    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("userId","branchId")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "managerName" TEXT,
    "color" TEXT NOT NULL DEFAULT '#dc2626',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" UUID NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "secondLastName" TEXT,
    "branchId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "hireDate" DATE NOT NULL,
    "terminationDate" DATE,
    "terminationReason" TEXT,
    "baseSalary" DECIMAL(14,2) NOT NULL,
    "salaryPeriodicity" "SalaryPeriodicity" NOT NULL DEFAULT 'WEEKLY',
    "baseDays" DECIMAL(6,2) NOT NULL DEFAULT 7,
    "calculationMode" "CalculationMode" NOT NULL DEFAULT 'FIXED',
    "overtimeRate" DECIMAL(14,2),
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "bankName" TEXT,
    "bankAccountReference" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryHistory" (
    "id" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "previousSalary" DECIMAL(14,2) NOT NULL,
    "newSalary" DECIMAL(14,2) NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "paymentDate" DATE NOT NULL,
    "periodType" "PeriodType" NOT NULL DEFAULT 'WEEKLY',
    "branchId" UUID,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollConcept" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ConceptType" NOT NULL,
    "requiresNote" BOOLEAN NOT NULL DEFAULT false,
    "allowsQuantity" BOOLEAN NOT NULL DEFAULT true,
    "allowsManualAmount" BOOLEAN NOT NULL DEFAULT true,
    "showInQuickCapture" BOOLEAN NOT NULL DEFAULT false,
    "showOnReceipt" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" UUID NOT NULL,
    "folio" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "periodId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeNumberSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "positionNameSnapshot" TEXT NOT NULL,
    "branchNameSnapshot" TEXT NOT NULL,
    "periodNameSnapshot" TEXT NOT NULL,
    "periodStartSnapshot" DATE NOT NULL,
    "periodEndSnapshot" DATE NOT NULL,
    "baseSalarySnapshot" DECIMAL(14,2) NOT NULL,
    "baseDaysSnapshot" DECIMAL(6,2) NOT NULL,
    "daysWorked" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "daysPaid" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "absences" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "delays" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "calculationModeSnapshot" "CalculationMode" NOT NULL,
    "totalIncome" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "generalNotes" TEXT,
    "receiptToken" TEXT,
    "previousPayrollId" UUID,
    "negativeAuthorizedById" UUID,
    "negativeAuthorizationReason" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" UUID,
    "paidAt" TIMESTAMP(3),
    "paidByUserId" UUID,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" UUID,
    "cancellationReason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollItem" (
    "id" UUID NOT NULL,
    "payrollId" UUID NOT NULL,
    "conceptId" UUID,
    "conceptCodeSnapshot" TEXT NOT NULL,
    "conceptNameSnapshot" TEXT NOT NULL,
    "type" "ConceptType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "referenceDate" DATE,
    "reference" TEXT,
    "notes" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPayment" (
    "id" UUID NOT NULL,
    "payrollId" UUID NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "cashAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "otherAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "transferReference" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "deliveredByUserId" UUID NOT NULL,
    "receivedByName" TEXT NOT NULL,
    "notes" TEXT,
    "signatureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollReceipt" (
    "id" UUID NOT NULL,
    "payrollId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "pdfPath" TEXT,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByUserId" UUID NOT NULL,

    CONSTRAINT "PayrollReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "businessName" TEXT NOT NULL DEFAULT 'Fatboy',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#dc2626',
    "secondaryColor" TEXT NOT NULL DEFAULT '#171717',
    "accentColor" TEXT NOT NULL DEFAULT '#f59e0b',
    "address" TEXT,
    "phone" TEXT,
    "receiptFooter" TEXT,
    "legalLegend" TEXT NOT NULL,
    "defaultPrintSize" "PrintSize" NOT NULL DEFAULT 'MM80',
    "showEmployeeSignature" BOOLEAN NOT NULL DEFAULT true,
    "showManagerSignature" BOOLEAN NOT NULL DEFAULT true,
    "showQr" BOOLEAN NOT NULL DEFAULT true,
    "defaultPeriodicity" "SalaryPeriodicity" NOT NULL DEFAULT 'WEEKLY',
    "defaultBaseDays" DECIMAL(6,2) NOT NULL DEFAULT 7,
    "defaultCalculationMode" "CalculationMode" NOT NULL DEFAULT 'FIXED',
    "allowNegativeTotal" BOOLEAN NOT NULL DEFAULT false,
    "requireNegativeApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireDiscountNotes" BOOLEAN NOT NULL DEFAULT false,
    "requireCancellationPassword" BOOLEAN NOT NULL DEFAULT true,
    "requireSignature" BOOLEAN NOT NULL DEFAULT false,
    "showZeroConcepts" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "timezone" TEXT NOT NULL DEFAULT 'America/Tijuana',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "branchId" UUID,
    "previousValues" JSONB,
    "newValues" JSONB,
    "metadata" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "fileType" "FileType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioCounter" (
    "year" INTEGER NOT NULL,
    "type" "FolioType" NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolioCounter_pkey" PRIMARY KEY ("year","type")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_lastName_firstName_idx" ON "User"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Position_code_key" ON "Position"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Position_name_key" ON "Position"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_branchId_isActive_idx" ON "Employee"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_positionId_idx" ON "Employee"("positionId");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Employee_hireDate_idx" ON "Employee"("hireDate");

-- CreateIndex
CREATE INDEX "EmployeeSalaryHistory_employeeId_effectiveDate_idx" ON "EmployeeSalaryHistory"("employeeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_folio_key" ON "PayrollPeriod"("folio");

-- CreateIndex
CREATE INDEX "PayrollPeriod_branchId_status_idx" ON "PayrollPeriod"("branchId", "status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_startDate_endDate_idx" ON "PayrollPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConcept_code_key" ON "PayrollConcept"("code");

-- CreateIndex
CREATE INDEX "PayrollConcept_type_isActive_displayOrder_idx" ON "PayrollConcept"("type", "isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_folio_key" ON "Payroll"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_receiptToken_key" ON "Payroll"("receiptToken");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_previousPayrollId_key" ON "Payroll"("previousPayrollId");

-- CreateIndex
CREATE INDEX "Payroll_periodId_status_idx" ON "Payroll"("periodId", "status");

-- CreateIndex
CREATE INDEX "Payroll_employeeId_createdAt_idx" ON "Payroll"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "Payroll_branchId_status_idx" ON "Payroll"("branchId", "status");

-- CreateIndex
CREATE INDEX "Payroll_createdAt_idx" ON "Payroll"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_periodId_employeeId_version_key" ON "Payroll"("periodId", "employeeId", "version");

-- CreateIndex
CREATE INDEX "PayrollItem_payrollId_type_displayOrder_idx" ON "PayrollItem"("payrollId", "type", "displayOrder");

-- CreateIndex
CREATE INDEX "PayrollItem_conceptId_idx" ON "PayrollItem"("conceptId");

-- CreateIndex
CREATE INDEX "PayrollPayment_payrollId_paidAt_idx" ON "PayrollPayment"("payrollId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollReceipt_payrollId_key" ON "PayrollReceipt"("payrollId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollReceipt_receiptNumber_key" ON "PayrollReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollReceipt_verificationToken_key" ON "PayrollReceipt"("verificationToken");

-- CreateIndex
CREATE INDEX "PayrollReceipt_generatedAt_idx" ON "PayrollReceipt"("generatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_username_createdAt_idx" ON "LoginAttempt"("username", "createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_ipAddress_createdAt_idx" ON "LoginAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storedName_key" ON "FileAsset"("storedName");

-- CreateIndex
CREATE INDEX "FileAsset_fileType_createdAt_idx" ON "FileAsset"("fileType", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryHistory" ADD CONSTRAINT "EmployeeSalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryHistory" ADD CONSTRAINT "EmployeeSalaryHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_previousPayrollId_fkey" FOREIGN KEY ("previousPayrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_negativeAuthorizedById_fkey" FOREIGN KEY ("negativeAuthorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollItem" ADD CONSTRAINT "PayrollItem_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "PayrollConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_deliveredByUserId_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollReceipt" ADD CONSTRAINT "PayrollReceipt_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
