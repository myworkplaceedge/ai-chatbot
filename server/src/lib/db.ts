import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import type { Config } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error("Missing TURSO_DATABASE_URL");
}

const libsqlConfig: Config = {
  url,
  authToken: authToken || undefined,
};

const adapter = new PrismaLibSQL(libsqlConfig);

export const prisma = new PrismaClient({ adapter });
