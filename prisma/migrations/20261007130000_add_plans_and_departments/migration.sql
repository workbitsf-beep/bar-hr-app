-- Piano Pro (acceso a mano dal super admin), reparti e capi reparto.
CREATE TYPE "VenuePlan" AS ENUM ('BASE', 'PRO');
CREATE TYPE "Department" AS ENUM ('BANCO', 'CUCINA', 'SALA', 'CUSTOM');
CREATE TYPE "DepartmentMode" AS ENUM ('UNIFIED', 'SEPARATE');

ALTER TABLE "Bar" ADD COLUMN "plan" "VenuePlan" NOT NULL DEFAULT 'BASE';
ALTER TABLE "Bar" ADD COLUMN "departmentMode" "DepartmentMode" NOT NULL DEFAULT 'UNIFIED';
ALTER TABLE "Bar" ADD COLUMN "customDepartmentName" TEXT;

ALTER TABLE "EmployeeBar" ADD COLUMN "department" "Department";
ALTER TABLE "EmployeeBar" ADD COLUMN "helpsIn" "Department"[] DEFAULT ARRAY[]::"Department"[];
ALTER TABLE "EmployeeBar" ADD COLUMN "isDepartmentLead" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Shift" ADD COLUMN "department" "Department";
CREATE INDEX "Shift_barId_department_startTime_idx" ON "Shift"("barId", "department", "startTime");
