import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";

export interface WetacaLaunch {
  command: string;
  baseArgs: string[];
}

/**
 * Resuelve cómo arrancar wetaca.
 * WETACA_BIN gana (ruta a un ejecutable, o a un .js/.mjs con shebang de Node).
 * Si no, se usa el wetaca-cli instalado junto a este paquete.
 */
export function resolveWetacaLaunch(): WetacaLaunch {
  const override = process.env.WETACA_BIN?.trim();
  if (override) {
    if (/\.(?:mjs|cjs|js)$/.test(override)) {
      return { command: process.execPath, baseArgs: [override] };
    }
    return { command: override, baseArgs: [] };
  }

  const require = createRequire(import.meta.url);
  let pkgJson: string;
  try {
    pkgJson = require.resolve("wetaca-cli/package.json");
  } catch {
    throw new Error(
      "No está instalado wetaca-cli y WETACA_BIN no está definido. " +
        "Ejecuta npm install en wetaca-mcp, o instala wetaca-cli y apunta WETACA_BIN a su ejecutable.",
    );
  }

  const bin = path.join(path.dirname(pkgJson), "bin", "wetaca.js");
  if (!existsSync(bin)) {
    throw new Error(`wetaca-cli está instalado pero falta el binario en ${bin}.`);
  }
  return { command: process.execPath, baseArgs: [bin] };
}
