DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'RequestType'
      AND e.enumlabel = 'OVERTIME'
  ) THEN
    ALTER TYPE "RequestType" ADD VALUE 'OVERTIME';
  END IF;
END $$;
