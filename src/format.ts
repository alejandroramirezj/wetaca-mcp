import type { ToolResult, ToolSpec, WetacaRunResult } from "./types.js";

const EXIT_CATEGORY: Record<number, string> = {
  0: "ok",
  1: "unexpected",
  2: "usage",
  3: "auth",
  4: "network",
  5: "not_found",
  6: "api",
  7: "contract_drift",
};

export function textResult(payload: unknown, isError = false): ToolResult {
  const result: ToolResult = {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
  if (isError) result.isError = true;
  return result;
}

function parseStderr(stderr: string): unknown {
  const text = stderr.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isDryRunData(data: unknown): boolean {
  return Boolean(data && typeof data === "object" && "dryRun" in data && (data as { dryRun?: unknown }).dryRun === true);
}

/**
 * Envuelve la salida del CLI.
 * wetaca_usage devuelve la guía en texto plano: es markdown, no JSON.
 */
export function formatCliResult(result: WetacaRunResult, tool: ToolSpec, confirmed: boolean): ToolResult {
  if (result.spawnError) {
    return textResult(
      {
        ok: false,
        exitCode: result.exitCode,
        category: "unexpected",
        message: result.spawnError,
      },
      true,
    );
  }

  if (tool.name === "wetaca_usage" && result.exitCode === 0) {
    return { content: [{ type: "text", text: result.stdout }] };
  }

  const stderr = result.stderr.trim();
  const parsedError = parseStderr(stderr);
  const payload: Record<string, unknown> = {
    ok: result.exitCode === 0,
    exitCode: result.exitCode,
    category: EXIT_CATEGORY[result.exitCode] ?? "unexpected",
    data: result.data,
  };
  if (parsedError !== undefined) payload.error = parsedError;
  if (stderr && parsedError === undefined) payload.stderr = stderr;

  if (!confirmed && tool.safety === "dry-run" && result.exitCode === 0 && isDryRunData(result.data)) {
    payload.agent_note =
      "Simulacro (--dry-run): la cuenta no ha cambiado. Enseña data.wouldSend a la persona. " +
      "Solo si confirma esa operación, vuelve a llamar con los mismos argumentos y confirm:true.";
  } else if (!confirmed && tool.safety === "confirm-cli" && result.exitCode === 2) {
    payload.agent_note =
      "La cuenta no ha cambiado. El CLI ha pedido confirmación (no hay terminal). " +
      "Enseña el resumen a la persona. Solo si dice que sí a esta operación concreta, " +
      `repite ${tool.name} con confirm:true.`;
  }

  return textResult(payload, result.exitCode !== 0);
}

export function confirmationRequired(toolName: string, commandArgs: string[]): ToolResult {
  return textResult(
    {
      ok: false,
      exitCode: 2,
      category: "usage",
      data: null,
      error: {
        error: {
          code: 2,
          category: "usage",
          reason: "confirmation_required",
          retryable: false,
          message:
            "Esta operación cambia la sesión o la configuración local y wetaca no pide confirmación. " +
            "No se ha ejecutado. Enseña el comando a la persona y espera un sí explícito.",
          equivalent_cli: `wetaca ${commandArgs.join(" ")}`,
          next_step: `Cuando la persona confirme, llama a ${toolName} con los mismos argumentos y confirm:true.`,
        },
      },
      agent_note:
        "No se ha cerrado la sesión ni se ha escrito la configuración. " +
        "No pases confirm:true hasta que la persona lo pida.",
    },
    true,
  );
}
