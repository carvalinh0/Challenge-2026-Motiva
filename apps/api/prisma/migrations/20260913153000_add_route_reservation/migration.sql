CREATE TABLE "routes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "status" TEXT NOT NULL DEFAULT 'defined',
    "createdBy" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME
);
ALTER TABLE "sensors" ADD COLUMN "route_id" INTEGER REFERENCES "routes"("id") ON DELETE SET NULL;
CREATE INDEX "sensors_route_id_idx" ON "sensors"("route_id");