CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User" ("role");

CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session" ("expiresAt");
CREATE INDEX IF NOT EXISTS "Session_revokedAt_expiresAt_idx" ON "Session" ("revokedAt", "expiresAt");

CREATE INDEX IF NOT EXISTS "Bar_ownerId_createdAt_idx" ON "Bar" ("ownerId", "createdAt");

CREATE INDEX IF NOT EXISTS "EmployeeBar_barId_isActive_idx" ON "EmployeeBar" ("barId", "isActive");
CREATE INDEX IF NOT EXISTS "EmployeeBar_barId_role_isActive_idx" ON "EmployeeBar" ("barId", "role", "isActive");
CREATE INDEX IF NOT EXISTS "EmployeeBar_userId_isActive_idx" ON "EmployeeBar" ("userId", "isActive");

CREATE INDEX IF NOT EXISTS "Shift_barId_startTime_idx" ON "Shift" ("barId", "startTime");
CREATE INDEX IF NOT EXISTS "Shift_barId_endTime_idx" ON "Shift" ("barId", "endTime");
CREATE INDEX IF NOT EXISTS "Shift_barId_confirmedAt_idx" ON "Shift" ("barId", "confirmedAt");

CREATE INDEX IF NOT EXISTS "TimeLog_barId_userId_type_timestamp_idx" ON "TimeLog" ("barId", "userId", "type", "timestamp");
CREATE INDEX IF NOT EXISTS "TimeLog_userId_timestamp_idx" ON "TimeLog" ("userId", "timestamp");

CREATE INDEX IF NOT EXISTS "Task_barId_status_dueDate_idx" ON "Task" ("barId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "Task_barId_assignedToId_status_idx" ON "Task" ("barId", "assignedToId", "status");

CREATE INDEX IF NOT EXISTS "Note_barId_isPinned_createdAt_idx" ON "Note" ("barId", "isPinned", "createdAt");

CREATE INDEX IF NOT EXISTS "Availability_barId_endsAt_idx" ON "Availability" ("barId", "endsAt");
CREATE INDEX IF NOT EXISTS "Availability_barId_userId_startsAt_idx" ON "Availability" ("barId", "userId", "startsAt");

CREATE INDEX IF NOT EXISTS "Request_barId_status_createdAt_idx" ON "Request" ("barId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Request_barId_type_status_idx" ON "Request" ("barId", "type", "status");
CREATE INDEX IF NOT EXISTS "Request_barId_startsAt_idx" ON "Request" ("barId", "startsAt");
CREATE INDEX IF NOT EXISTS "Request_swapWithUserId_idx" ON "Request" ("swapWithUserId");
