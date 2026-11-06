import type { z } from "zod";

/** Cómo se protege una herramienta respecto al modelo de --dry-run / --yes del CLI. */
export type Safety = "read" | "dry-run" | "confirm-cli" | "confirm-mcp";

/**
 * Argumentos que puede recibir cualquier herramienta.
 * Cada herramienta solo declara en su schema los campos que usa.
 */
export interface ToolArgs {
  profile?: string;
  debug?: boolean;
  confirm?: boolean;
  weeks?: number;
  feedback?: string;
  suggestion?: string;
  profile_suggestion?: string;
  set?: string;
  resume?: boolean;
  zipcode?: string | number;
  option_id?: string | number;
  slug?: string;
  profile_ref?: string;
  limit?: number;
  offset?: number;
  order_id?: string | number;
  address_id?: string | number;
  street?: string;
  number?: string;
  floor?: string;
  city?: string;
  notes?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  code?: string;
  key?: string;
  value?: string;
}

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  safety: Safety;
  /** true si, con confirm:true, la operación puede borrar o cambiar datos existentes. */
  destructive: boolean;
  /** true si repetir la misma llamada no cambia más el estado. */
  idempotent: boolean;
  schema: z.ZodObject<z.ZodRawShape>;
  /** Argumentos del CLI después de las flags globales, incluido el verbo. */
  command: (input: ToolArgs) => string[];
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface WetacaRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  data: unknown;
  /** Fallo al arrancar el proceso, tiempo de espera agotado o salida demasiado grande. */
  spawnError?: string;
}
