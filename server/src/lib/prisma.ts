import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// A single shared client reuses Prisma's connection pool across the process
// instead of opening a new pool per import (which would exhaust Postgres
// connections under `tsx watch` hot-reload or repeated test imports).
export const prisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
