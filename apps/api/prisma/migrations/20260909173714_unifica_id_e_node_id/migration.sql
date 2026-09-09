/*
  Warnings:

  - You are about to alter the column `sensor_id` on the `measurements` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `sensors` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `node_id` on the `sensors` table. All the data in the column will be lost.
  - You are about to alter the column `id` on the `sensors` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `proxy_id` on the `sensors` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_measurements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sensor_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measurements_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_measurements" ("id", "sensor_id", "timestamp", "value") SELECT "id", "sensor_id", "timestamp", "value" FROM "measurements";
DROP TABLE "measurements";
ALTER TABLE "new_measurements" RENAME TO "measurements";
CREATE INDEX "measurements_sensor_id_timestamp_idx" ON "measurements"("sensor_id", "timestamp");
CREATE TABLE "new_sensors" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "type" TEXT NOT NULL DEFAULT 'sensor',
    "proxy_id" INTEGER,
    "last_seen" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sensors_proxy_id_fkey" FOREIGN KEY ("proxy_id") REFERENCES "sensors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_sensors" ("created_at", "id", "last_seen", "latitude", "longitude", "name", "proxy_id", "type") SELECT "created_at", "id", "last_seen", "latitude", "longitude", "name", "proxy_id", "type" FROM "sensors";
DROP TABLE "sensors";
ALTER TABLE "new_sensors" RENAME TO "sensors";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
