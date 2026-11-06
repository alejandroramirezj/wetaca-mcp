import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { buildWetacaArgv } from "../dist/args.js";
import { resolveWetacaLaunch } from "../dist/launch.js";
import { TOOLS } from "../dist/registry.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverPath = path.join(root, "dist", "index.js");
const fakeWetaca = path.join(root, "test", "fixtures", "fake-wetaca.mjs");

const tempDirs = [];

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "wetaca-mcp-"));
  tempDirs.push(dir);
  return dir;
}

function baseEnv(extra = {}) {
  return { ...getDefaultEnvironment(), ...extra };
}

async function withClient(env, fn) {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: root,
    env,
    stderr: "pipe",
  });
  const client = new Client({ name: "wetaca-mcp-test", version: "0.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

function textOf(result) {
  const block = result.content?.find((item) => item.type === "text");
  assert.ok(block && "text" in block);
  return block.text;
}

const sample = {
  profile: "casa",
  debug: true,
  weeks: 2,
  feedback: "viaje",
  suggestion: "sug1",
  profile_suggestion: "ps1",
  set: "10:2,11:1",
  resume: false,
  zipcode: "08001",
  option_id: 4,
  slug: "pollo-asado",
  profile_ref: "Ana",
  limit: 5,
  offset: 0,
  order_id: 99,
  address_id: 3,
  street: "Calle Mayor",
  number: "12",
  floor: "3",
  city: "Madrid",
  notes: "portero",
  firstname: "Ana",
  lastname: "López",
  phone: "600000000",
  code: "CUPON",
  key: "defaultProfile",
  value: "casa",
};

test("hay una herramienta por cada flujo de agente del CLI, sin duplicados", () => {
  const names = TOOLS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, [
    "wetaca_usage",
    "wetaca_doctor",
    "wetaca_auth_status",
    "wetaca_auth_logout",
    "wetaca_me",
    "wetaca_subscription_show",
    "wetaca_subscription_pause",
    "wetaca_subscription_resume",
    "wetaca_suggestion_show",
    "wetaca_suggestion_pause",
    "wetaca_suggestion_resume",
    "wetaca_suggestion_edit",
    "wetaca_deliveries_next",
    "wetaca_deliveries_options",
    "wetaca_deliveries_set_option",
    "wetaca_menu_list",
    "wetaca_dish_show",
    "wetaca_profiles_list",
    "wetaca_profiles_pause",
    "wetaca_profiles_resume",
    "wetaca_orders_list",
    "wetaca_orders_show",
    "wetaca_orders_cancel",
    "wetaca_addresses_list",
    "wetaca_addresses_save",
    "wetaca_addresses_remove",
    "wetaca_vouchers_list",
    "wetaca_vouchers_current",
    "wetaca_vouchers_apply",
    "wetaca_vouchers_skip",
    "wetaca_giftcards_show",
    "wetaca_giftcards_redeem",
    "wetaca_wallet_show",
    "wetaca_config_path",
    "wetaca_config_list",
    "wetaca_config_get",
    "wetaca_config_set",
  ]);
});

test("el README documenta cada herramienta y la configuración de Claude y Cursor", async () => {
  const readme = await readFile(path.join(root, "README.md"), "utf8");
  for (const tool of TOOLS) assert.ok(readme.includes(tool.name), tool.name);
  assert.match(readme, /mcpServers/);
  assert.match(readme, /wetaca-mcp/);
  assert.match(readme, /Claude Desktop/);
  assert.match(readme, /Cursor/);
  assert.match(readme, /https:\/\/github.com\/gorgueugr\/wetaca-cli/);
  assert.match(readme, /Jorge Soler Padial/);
  assert.match(readme, /No está afiliado a Wetaca/);
  assert.match(readme, /MIT/);
  assert.match(readme, /WETACA_TOKEN/);
  assert.match(readme, /confirm/);
});

test("las mutaciones exigen confirm y las lecturas no", () => {
  for (const tool of TOOLS) {
    const shape = tool.schema.shape;
    if (tool.safety === "read") {
      assert.equal(shape.confirm, undefined, tool.name);
      assert.equal(tool.destructive, false, tool.name);
    } else {
      assert.ok(shape.confirm, tool.name);
    }
  }
});

test("el argv respeta dry-run, --yes y no deja que un perfil malicioso confirme", () => {
  for (const tool of TOOLS) {
    for (const confirm of [false, true]) {
      const argv = buildWetacaArgv(tool, { ...sample, confirm });
      assert.ok(argv.includes("--format=json"), tool.name);
      assert.ok(argv.includes("--error-format=json"), tool.name);
      assert.ok(argv.includes("--no-input"), tool.name);
      assert.ok(argv.includes("--profile=casa"), tool.name);
      assert.ok(argv.includes("--debug"), tool.name);
      const yes = argv.filter((arg) => arg === "--yes").length;
      const dry = argv.filter((arg) => arg === "--dry-run").length;
      assert.ok(yes + dry <= 1, `${tool.name} no puede llevar --yes y --dry-run`);
      if (tool.safety === "read" || tool.safety === "confirm-mcp") {
        assert.equal(yes, 0, tool.name);
        assert.equal(dry, 0, tool.name);
      } else if (tool.safety === "dry-run") {
        assert.equal(dry, confirm ? 0 : 1, tool.name);
        assert.equal(yes, confirm ? 1 : 0, tool.name);
      } else {
        assert.equal(dry, 0, tool.name);
        assert.equal(yes, confirm ? 1 : 0, tool.name);
      }
    }
  }

  const cancel = TOOLS.find((tool) => tool.name === "wetaca_orders_cancel");
  const injected = buildWetacaArgv(cancel, { order_id: 5, profile: "--yes", confirm: false });
  assert.deepEqual(injected.filter((arg) => arg === "--yes"), []);
  assert.ok(injected.includes("--profile=--yes"));
  assert.ok(injected.includes("--dry-run"));
  assert.ok(injected.includes("--"));
  assert.ok(injected.includes("5"));

  const edit = buildWetacaArgv(
    TOOLS.find((tool) => tool.name === "wetaca_suggestion_edit"),
    { profile_suggestion: "ps1", set: "10:2,11:1", resume: false, confirm: false },
  );
  assert.ok(edit.includes("--profile-suggestion=ps1"));
  assert.ok(edit.includes("--set=10:2,11:1"));
  assert.ok(edit.includes("--resume=false"));
  assert.ok(edit.includes("suggestion"));
  assert.ok(edit.includes("edit"));

  const save = buildWetacaArgv(
    TOOLS.find((tool) => tool.name === "wetaca_addresses_save"),
    { street: "Calle Mayor", number: "12", zipcode: "08001", city: "Madrid", confirm: true },
  );
  assert.ok(save.includes("--street=Calle Mayor"));
  assert.ok(save.includes("--zipcode=08001"));
  assert.ok(save.includes("--yes"));
  assert.equal(save.includes("--dry-run"), false);

  const skip = buildWetacaArgv(TOOLS.find((tool) => tool.name === "wetaca_vouchers_skip"), { confirm: false });
  assert.ok(skip.includes("vouchers"));
  assert.ok(skip.includes("skip"));
  assert.ok(skip.includes("--dry-run"));
});

test("sin WETACA_BIN arranca el wetaca-cli empaquetado", () => {
  const previous = process.env.WETACA_BIN;
  delete process.env.WETACA_BIN;
  try {
    const launch = resolveWetacaLaunch();
    assert.equal(launch.command, process.execPath);
    assert.ok(launch.baseArgs[0].endsWith(`${path.sep}wetaca.js`));
  } finally {
    if (previous === undefined) delete process.env.WETACA_BIN;
    else process.env.WETACA_BIN = previous;
  }
});

test("el servidor stdio lista las herramientas y lee la guía real del CLI", async () => {
  const dir = await tempDir();
  const env = baseEnv({ WETACA_CONFIG_DIR: dir });
  await withClient(env, async (client) => {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, TOOLS.length);
    const cancel = listed.tools.find((tool) => tool.name === "wetaca_orders_cancel");
    assert.ok(cancel);
    assert.equal(cancel.annotations?.readOnlyHint, false);
    assert.equal(cancel.annotations?.destructiveHint, true);
    assert.ok(cancel.inputSchema.properties?.confirm);
    assert.equal((cancel.inputSchema.required ?? []).includes("confirm"), false);

    const usage = listed.tools.find((tool) => tool.name === "wetaca_usage");
    assert.equal(usage.annotations?.readOnlyHint, true);
    assert.equal(usage.inputSchema.properties?.confirm, undefined);

    const guide = await client.callTool({ name: "wetaca_usage", arguments: {} });
    const guideText = textOf(guide);
    assert.equal(guide.isError, undefined);
    assert.match(guideText, /guide for AI agents/);
    assert.match(guideText, /Never manage payments/);
    assert.match(guideText, /--dry-run/);

    const status = await client.callTool({ name: "wetaca_auth_status", arguments: {} });
    const body = JSON.parse(textOf(status));
    assert.equal(body.ok, true);
    assert.equal(body.data.authenticated, false);
    assert.equal(body.data.profile, "default");
  });
});

test("por stdio, cancelar es dry-run y cerrar sesión no arranca el CLI sin confirm", async () => {
  const dir = await tempDir();
  const log = path.join(dir, "calls.log");
  const env = baseEnv({
    WETACA_CONFIG_DIR: dir,
    WETACA_BIN: fakeWetaca,
    FAKE_WETACA_LOG: log,
  });

  await withClient(env, async (client) => {
    const dry = await client.callTool({
      name: "wetaca_orders_cancel",
      arguments: { order_id: 15 },
    });
    const dryBody = JSON.parse(textOf(dry));
    assert.equal(dryBody.ok, true);
    assert.equal(dryBody.data.argv.includes("--dry-run"), true);
    assert.equal(dryBody.data.argv.includes("--yes"), false);
    assert.equal(dryBody.data.argv.includes("15"), true);
    assert.match(dryBody.agent_note, /Simulacro/);

    const blocked = await client.callTool({ name: "wetaca_auth_logout", arguments: {} });
    assert.equal(blocked.isError, true);
    const blockedBody = JSON.parse(textOf(blocked));
    assert.equal(blockedBody.error.error.reason, "confirmation_required");
    const callsAfterBlock = await readFile(log, "utf8");
    assert.equal(callsAfterBlock.includes("logout"), false);

    const allowed = await client.callTool({
      name: "wetaca_auth_logout",
      arguments: { confirm: true },
    });
    const allowedBody = JSON.parse(textOf(allowed));
    assert.equal(allowedBody.ok, true);
    assert.equal(allowedBody.data.argv.includes("logout"), true);
    assert.equal(allowedBody.data.argv.includes("--yes"), false);

    const confirmedCancel = await client.callTool({
      name: "wetaca_orders_cancel",
      arguments: { order_id: 15, confirm: true, profile: "--yes" },
    });
    const confirmedArgv = JSON.parse(textOf(confirmedCancel)).data.argv;
    assert.deepEqual(confirmedArgv.filter((arg) => arg === "--yes"), ["--yes"]);
    assert.ok(confirmedArgv.includes("--profile=--yes"));
    assert.equal(confirmedArgv.includes("--dry-run"), false);
  });
});

test("el proceso stdio arranca y termina cuando el cliente cierra stdin", async () => {
  const child = spawn(process.execPath, [serverPath], { stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdin.end();
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`el servidor no terminó. stderr: ${stderr}`));
    }, 5000);
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  assert.equal(code, 0);
  assert.match(stderr, /wetaca-mcp/);
  assert.match(stderr, /stdio/);
});
