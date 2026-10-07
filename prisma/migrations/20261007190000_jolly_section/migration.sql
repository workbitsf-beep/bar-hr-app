-- Il Jolly diventa una sezione tra i reparti: i turni Jolly li fa chiunque.
ALTER TYPE "Department" ADD VALUE IF NOT EXISTS 'JOLLY';
ALTER TABLE "EmployeeBar" DROP COLUMN IF EXISTS "isJolly";
-- Le note (Task) mandate a un reparto ricordano il reparto.
ALTER TABLE "Task" ADD COLUMN "department" "Department";
