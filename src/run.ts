import { spawn } from "node:child_process";
import { resolveWetacaLaunch } from "./launch.js";
import type { WetacaRunResult } from "./types.js";

const MAX_OUTPUT_CHARS = 5_000_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function readTimeout(): number {
  const raw = process.env.WETACA_MCP_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TIMEOUT_MS;
  return parsed;
}

function parseStdout(stdout: string): unknown {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function spawnMessage(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
  const message = err instanceof Error ? err.message : String(err);
  if (code === "ENOENT") {
    return (
      `No se encontró wetaca (${message}). ` +
      "Instala wetaca-cli o define WETACA_BIN con la ruta del ejecutable."
    );
  }
  return `No se pudo ejecutar wetaca: ${message}`;
}

/**
 * Ejecuta wetaca y captura stdout/stderr.
 * El código de salida del CLI no lanza: vuelve dentro del resultado.
 * Hereda el entorno del proceso MCP (WETACA_TOKEN, WETACA_REFRESH_TOKEN, XDG_CONFIG_HOME, …).
 */
export function runWetaca(argv: string[]): Promise<WetacaRunResult> {
  let launch;
  try {
    launch = resolveWetacaLaunch();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Promise.resolve({ exitCode: 1, stdout: "", stderr: "", data: null, spawnError: message });
  }

  const timeoutMs = readTimeout();
  const { command, baseArgs } = launch;

  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    let overflow = false;

    const finish = (result: WetacaRunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const child = spawn(command, [...baseArgs, ...argv], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({
        exitCode: 1,
        stdout,
        stderr,
        data: null,
        spawnError:
          `wetaca superó el tiempo de espera (${timeoutMs} ms). ` +
          "Puedes subir WETACA_MCP_TIMEOUT_MS si la red va lenta.",
      });
    }, timeoutMs);

    const take = (target: "stdout" | "stderr", chunk: string) => {
      if (target === "stdout") stdout += chunk;
      else stderr += chunk;
      if (!overflow && stdout.length + stderr.length > MAX_OUTPUT_CHARS) {
        overflow = true;
        child.kill("SIGKILL");
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => take("stdout", chunk));
    child.stderr.on("data", (chunk: string) => take("stderr", chunk));

    child.on("error", (err) => {
      finish({ exitCode: 1, stdout, stderr, data: null, spawnError: spawnMessage(err) });
    });

    child.on("close", (code) => {
      if (overflow) {
        finish({
          exitCode: 1,
          stdout: "",
          stderr,
          data: null,
          spawnError: "La salida de wetaca superó el límite de 5 MB y se cortó.",
        });
        return;
      }
      finish({
        exitCode: code ?? 1,
        stdout,
        stderr,
        data: parseStdout(stdout),
      });
    });
  });
}
