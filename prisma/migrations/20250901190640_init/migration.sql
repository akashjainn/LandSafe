-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carrierIata" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "serviceDate" DATETIME NOT NULL,
    "originIata" TEXT,
    "destIata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "notes" TEXT,
    "latestSchedDep" DATETIME,
    "latestSchedArr" DATETIME,
    "latestEstDep" DATETIME,
    "latestEstArr" DATETIME,
    "latestGateDep" TEXT,
    "latestGateArr" TEXT,
    "latestStatus" TEXT DEFAULT 'SCHEDULED'
);

-- CreateTable
CREATE TABLE "FlightStatusSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flightId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schedDep" DATETIME,
    "schedArr" DATETIME,
    "estDep" DATETIME,
    "estArr" DATETIME,
    "actDep" DATETIME,
    "actArr" DATETIME,
    "gateDep" TEXT,
    "gateArr" TEXT,
    "terminalDep" TEXT,
    "terminalArr" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "delayReason" TEXT,
    "aircraftType" TEXT,
    "routeKey" TEXT,
    CONSTRAINT "FlightStatusSnapshot_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Flight_serviceDate_carrierIata_flightNumber_idx" ON "Flight"("serviceDate", "carrierIata", "flightNumber");
