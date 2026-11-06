#!/usr/bin/env node
// Sustituto de wetaca para las pruebas: no llama a la API y escribe el argv.
import fs from "node:fs";

const args = process.argv.slice(2);
const log = process.env.FAKE_WETACA_LOG;
if (log) fs.appendFileSync(log, JSON.stringify(args) + "\n");
const dryRun = args.includes("--dry-run");
const payload = dryRun
  ? { dryRun: true, wouldSend: { argv: args }, argv: args }
  : { argv: args };
process.stdout.write(JSON.stringify(payload));
process.exit(0);
