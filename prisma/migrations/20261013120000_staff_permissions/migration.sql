-- Responsabile and Amministrazione get permissions and a scope chosen by the owner.
ALTER TABLE "EmployeeBar" ADD COLUMN "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EmployeeBar" ADD COLUMN "managesDepartments" "Department"[] DEFAULT ARRAY[]::"Department"[];

-- Everyone keeps exactly what they could do before.
UPDATE "EmployeeBar" SET "permissions" = ARRAY['shifts','requests','timelogs','notes','checklists']
  WHERE "role" = 'MANAGER';
UPDATE "EmployeeBar" SET "permissions" = ARRAY['timelogs','documents','reports']
  WHERE "role" = 'AMMINISTRAZIONE';

-- A department lead was an employee running their department's shifts and
-- requests: now a Responsabile of that department with those two permissions.
UPDATE "EmployeeBar"
  SET "role" = 'MANAGER', "managesDepartments" = ARRAY["department"], "permissions" = ARRAY['shifts','requests']
  WHERE "isDepartmentLead" = true AND "role" = 'EMPLOYEE' AND "department" IS NOT NULL;

-- Their account follows, as syncUserRole would.
UPDATE "User" SET "role" = 'MANAGER'
  WHERE "role" = 'EMPLOYEE'
    AND EXISTS (SELECT 1 FROM "EmployeeBar" eb WHERE eb."userId" = "User"."id" AND eb."isActive" = true AND eb."role" = 'MANAGER');
