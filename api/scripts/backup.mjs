#!/usr/bin/env node
/**
 * PointVet 17.1 — Logical PostgreSQL backup (no database mutation).
 * Requires pg_dump and DATABASE_URL or BACKUP_DATABASE_URL.
 * Never prints database credentials. Do not commit output files.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const connection = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
const output = process.argv[2];
if (!connection || !output) {
  console.error("Usage: BACKUP_DATABASE_URL=<secret> node backup.mjs <backup-file.dump>");
  process.exit(2);
}
if (!output.endsWith(".dump")) {
  console.error("Backup file must end in .dump");
  process.exit(2);
}
const file = resolve(output);
mkdirSync(dirname(file), { recursive: true });
const run = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", file, "--dbname", connection], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
if (run.error || run.status !== 0) {
  // Never print pg_dump stderr: connection URIs can contain credentials.
  console.error("Backup failed. Verify pg_dump installation, connectivity, permissions, and free disk space.");
  process.exit(1);
}
const hash = createHash("sha256");
await pipeline(createReadStream(file), async function* (source) {
  for await (const chunk of source) { hash.update(chunk); yield chunk; }
}, createWriteStream("/dev/null"));
const data = { createdAt: new Date().toISOString(), bytes: statSync(file).size, sha256: hash.digest("hex"), format: "pg_dump/custom" };
writeFileSync(file + ".sha256", data.sha256 + "  " + file.split("/").at(-1) + "\n", { mode: 0o600 });
writeFileSync(file + ".json", JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
console.log("Backup created and SHA-256 recorded. Check the dump using pg_restore --list before an isolated restore.");
