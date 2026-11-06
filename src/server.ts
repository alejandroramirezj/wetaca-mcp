import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { executeTool } from "./execute.js";
import { TOOLS } from "./registry.js";
import type { ToolArgs } from "./types.js";
import { PACKAGE_VERSION } from "./version.js";

const INSTRUCTIONS = [
  "Servidor MCP de Wetaca. No llama a api.wetaca.com por su cuenta: ejecuta wetaca-cli",
  "(JSON, --error-format json, --no-input) y reutiliza su sesión en ~/.config/wetaca-cli",
  "(o $XDG_CONFIG_HOME/wetaca-cli) y las variables WETACA_TOKEN / WETACA_REFRESH_TOKEN.",
  "Lee wetaca_usage antes de cambiar nada. Las lecturas se pueden llamar libremente.",
  "Las herramientas que modifican la cuenta hacen dry-run, o devuelven confirmation_required,",
  "hasta que confirm sea true (equivale a --yes). Pasa confirm:true solo si la persona pidió",
  "exactamente esa operación y ya vio el resumen.",
  "No gestiona pagos ni tarjetas. Si el resultado trae reason auth_required, la persona tiene",
  "que ejecutar `wetaca auth login` en su terminal. No pidas contraseñas ni pegues tokens en el chat.",
  "Proyecto independiente, no afiliado a Wetaca. La base es https://github.com/gorgueugr/wetaca-cli.",
].join(" ");

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "wetaca-mcp",
      version: PACKAGE_VERSION,
      title: "Wetaca",
    },
    {
      instructions: INSTRUCTIONS,
      capabilities: { tools: {} },
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.safety === "read",
          destructiveHint: tool.destructive,
          idempotentHint: tool.idempotent,
          openWorldHint: true,
        },
      },
      async (args) => executeTool(tool, args as ToolArgs) as Promise<CallToolResult>,
    );
  }

  return server;
}
