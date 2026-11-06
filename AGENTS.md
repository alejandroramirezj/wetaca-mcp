# AGENTS.md

Este repositorio es un servidor MCP (stdio) que envuelve `wetaca-cli`. No reimplementa la API de Wetaca.

- El contrato de la cuenta está en el CLI: `wetaca skills get wetaca-usage` y https://github.com/gorgueugr/wetaca-cli.
- Las herramientas viven en `src/registry.ts`. Si el CLI no tiene un comando, no lo añadas aquí.
- Las mutaciones salen en `--dry-run` o sin `--yes` hasta que el argumento `confirm` es `true`.
- No añadas un login que reciba el token: la sesión se lee de `~/.config/wetaca-cli` o de `WETACA_TOKEN` / `WETACA_REFRESH_TOKEN`.
- No gestiones pagos ni tarjetas.
- Node ≥ 20. Comprobar con `npm test` (compila y ejecuta los tests).
