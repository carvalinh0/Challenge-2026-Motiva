-- CreateTable
CREATE TABLE "sensors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "type" TEXT NOT NULL DEFAULT 'sensor',
    "node_id" INTEGER,
    "proxy_id" TEXT,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sensors_proxy_id_fkey" FOREIGN KEY ("proxy_id") REFERENCES "sensors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sensor_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measurements_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sensors_node_id_key" ON "sensors"("node_id");

-- CreateIndex
CREATE INDEX "measurements_sensor_id_timestamp_idx" ON "measurements"("sensor_id", "timestamp");
