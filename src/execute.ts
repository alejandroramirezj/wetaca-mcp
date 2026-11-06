import { buildWetacaArgv } from "./args.js";
import { confirmationRequired, formatCliResult, textResult } from "./format.js";
import { runWetaca } from "./run.js";
import type { ToolArgs, ToolResult, ToolSpec } from "./types.js";

export async function executeTool(tool: ToolSpec, input: ToolArgs): Promise<ToolResult> {
  try {
    if (tool.safety === "confirm-mcp" && input.confirm !== true) {
      return confirmationRequired(tool.name, tool.command(input));
    }
    const argv = buildWetacaArgv(tool, input);
    const result = await runWetaca(argv);
    return formatCliResult(result, tool, input.confirm === true);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return textResult({ ok: false, exitCode: 1, category: "unexpected", message }, true);
  }
}
