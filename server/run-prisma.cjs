"use strict";
const path = require("path");
const { spawnSync } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// The Prisma CLI reads `env("PRISMA_DATABASE_URL")` from schema.prisma.
// Default it to a local file when the contributor hasn't set one — keeps
// `db:push:local` / `db:migrate:dev` working out of the box without forcing
// the local-development URL into .env.example for every contributor.
if (!process.env.PRISMA_DATABASE_URL) {
  process.env.PRISMA_DATABASE_URL = "file:./dev.db";
}

const result = spawnSync("npx", ["prisma", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  cwd: __dirname,
  env: process.env,
});
process.exit(result.status === null ? 1 : result.status);
