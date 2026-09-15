-- CreateTable
CREATE TABLE "routes" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'defined',
    "created_by" TEXT NOT NULL,
    "base_latitude" DOUBLE PRECISION NOT NULL,
    "base_longitude" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" INTEGER NOT NULL,
    "name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "type" TEXT NOT NULL DEFAULT 'sensor',
    "proxy_id" INTEGER,
    "last_seen" TIMESTAMP(3),
    "deferred_at" TIMESTAMP(3),
    "route_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" SERIAL NOT NULL,
    "sensor_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "measurements_sensor_id_timestamp_idx" ON "measurements"("sensor_id", "timestamp");

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_proxy_id_fkey" FOREIGN KEY ("proxy_id") REFERENCES "sensors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;