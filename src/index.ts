#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createServer } from "./server.js";
import { PACKAGE_VERSION } from "./version.js";

console.error(`wetaca-mcp ${PACKAGE_VERSION} escuchando en stdio`);
serveStdio(() => createServer());
