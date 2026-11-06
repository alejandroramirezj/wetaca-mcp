import type { Safety, ToolArgs, ToolSpec } from "./types.js";

/** Añade --nombre=valor solo cuando el valor viene informado. */
export function flags(
  entries: Array<[string, string | number | boolean | undefined]>,
): string[] {
  const out: string[] = [];
  for (const [name, value] of entries) {
    if (value === undefined) continue;
    out.push(`--${name}=${value}`);
  }
  return out;
}

/** Coloca los posicionales detrás de `--` para que no se interpreten como flags. */
export function positional(
  command: string[],
  positionals: Array<string | number | undefined>,
): string[] {
  const values = positionals.filter((value) => value !== undefined && value !== "").map(String);
  if (values.length === 0) return command;
  return [...command, "--", ...values];
}

/**
 * Construye el argv de wetaca.
 * Las flags con valor van como `--flag=valor` (un solo argumento) para que un
 * valor que empiece por `--` no se convierta en otra flag.
 * Los posicionales van después de `--`.
 */
export function buildWetacaArgv(spec: Pick<ToolSpec, "safety" | "command">, input: ToolArgs): string[] {
  const argv = ["--format=json", "--error-format=json", "--no-input"];
  if (input.profile) argv.push(`--profile=${input.profile}`);
  if (input.debug === true) argv.push("--debug");
  argv.push(...safetyFlags(spec.safety, input.confirm === true));
  argv.push(...spec.command(input));
  return argv;
}

export function safetyFlags(safety: Safety, confirm: boolean): string[] {
  if (safety === "dry-run") return [confirm ? "--yes" : "--dry-run"];
  if (safety === "confirm-cli" && confirm) return ["--yes"];
  return [];
}
