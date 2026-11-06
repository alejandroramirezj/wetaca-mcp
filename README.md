# wetaca-mcp

Servidor [MCP](https://modelcontextprotocol.io) para gestionar tu Wetaca desde Claude Desktop, Cursor y cualquier cliente que hable stdio. Cubre la suscripción, el menú de la semana, las entregas, los pedidos, los cupones, las tarjetas regalo y el monedero.

**No está afiliado a Wetaca.** Es un proyecto independiente. No usa una API privada: lanza [`wetaca-cli`](https://github.com/gorgueugr/wetaca-cli), que a su vez habla con el mismo GraphQL que la web (`api.wetaca.com`).

No gestiona pagos ni tarjetas. Si hay un cobro pendiente, se paga en [wetaca.com](https://wetaca.com).

## Créditos

La base es **wetaca-cli** (npm `wetaca-cli`, MIT), de **Jorge Soler Padial** ([gorgueugr](https://github.com/gorgueugr)):

https://github.com/gorgueugr/wetaca-cli

Este paquete no reimplementa la API. Cada herramienta construye un comando de ese CLI y lo ejecuta con `--format=json`, `--error-format=json` y `--no-input`. Así el contrato (códigos de salida, confirmaciones, deriva del esquema) sigue siendo el del CLI instalado. La versión empaquetada es `wetaca-cli@0.2.6`. Si quieres usar otro binario —por ejemplo el `wetaca` global con el que iniciaste sesión— define `WETACA_BIN`.

## Requisitos

- Node.js **20 o superior** (el CLI admite Node 18; el SDK de MCP que usa este servidor pide 20).
- Una sesión de Wetaca creada con el CLI. El servidor no pide la contraseña y no abre el navegador.

## Instalación

Desde este repositorio:

```bash
npm install
npm run build
```

El ejecutable queda en `dist/index.js`. El comando del paquete es `wetaca-mcp`.

Cuando el paquete esté publicado en npm:

```bash
npx -y wetaca-mcp
```

Para iniciar sesión hace falta el comando `wetaca`, que viene de wetaca-cli (no de este paquete):

```bash
npm install -g wetaca-cli@0.2.6
wetaca doctor
```

También vale `npx wetaca-cli@0.2.6 doctor` sin instalación global.

## Autenticación

El servidor no guarda secretos y no tiene una herramienta de login. Reutiliza la sesión que ya creó el CLI.

1. Entra en wetaca.com con tu cuenta.
2. Abre las herramientas de desarrollo (F12) → Red → cualquier petición a `api.wetaca.com`.
3. Copia el valor del encabezado `authorization: Bearer …` (solo el token, sin la palabra Bearer).
4. En la terminal:

```bash
wetaca auth login --token <TOKEN>
wetaca auth status
```

El CLI comprueba el token, pide las cookies de sesión a wetaca.com y las guarda en:

- Linux y macOS: `$XDG_CONFIG_HOME/wetaca-cli` o `~/.config/wetaca-cli`
- Windows: `%USERPROFILE%\.config\wetaca-cli`

Los secretos van a `credentials.json` (permisos solo para tu usuario). El resto, a `config.json`. A partir de ahí, el MCP usa esa misma carpeta: no hace falta volver a pegar el token.

También puedes pasar la sesión por el entorno del proceso MCP, sin escribirla en el repo:

- `WETACA_TOKEN` tiene prioridad sobre el fichero.
- `WETACA_REFRESH_TOKEN` renueva la sesión sin disco (pensado para CI).

No pongas esos valores en un `mcp.json` que vaya a git. Si los necesitas, ponlos solo en la configuración de usuario del cliente. No pegues el token en el chat: el modelo lo vería.

Si una herramienta responde `auth_required` (código de salida 3), la sesión no vale. Hay que repetir `wetaca auth login` en la terminal. El servidor no automatiza el navegador ni pide la contraseña de Google.

Otras formas de entrar (`--cookies`, `--refresh-token`) están en `wetaca auth login --help` y en el README de wetaca-cli. El camino recomendado es `--token`.

## Claude Desktop

Archivo de configuración:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Con el repo ya compilado (sustituye la ruta):

```json
{
  "mcpServers": {
    "wetaca": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/al/repo/dist/index.js"]
    }
  }
}
```

Cuando `wetaca-mcp` esté en npm:

```json
{
  "mcpServers": {
    "wetaca": {
      "command": "npx",
      "args": ["-y", "wetaca-mcp"]
    }
  }
}
```

El mismo JSON está en [`examples/claude-desktop.mcp.json`](examples/claude-desktop.mcp.json). Reinicia Claude Desktop después de guardar.

## Cursor

Configuración global en `~/.cursor/mcp.json`, o solo para un proyecto en `.cursor/mcp.json` (ese fichero no debería llevar tokens).

```json
{
  "mcpServers": {
    "wetaca": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/al/repo/dist/index.js"]
    }
  }
}
```

Con el paquete publicado:

```json
{
  "mcpServers": {
    "wetaca": {
      "command": "npx",
      "args": ["-y", "wetaca-mcp"]
    }
  }
}
```

Copia de partida: [`examples/cursor.mcp.json`](examples/cursor.mcp.json).

Para forzar el mismo `wetaca` con el que iniciaste sesión, añade `env` en ese JSON de usuario (no en el repositorio):

```json
{
  "mcpServers": {
    "wetaca": {
      "command": "node",
      "args": ["/RUTA/ABSOLUTA/al/repo/dist/index.js"],
      "env": {
        "WETACA_BIN": "/ruta/al/ejecutable/wetaca"
      }
    }
  }
}
```

## Seguridad de las herramientas

El modelo de seguridad es el del CLI (`--dry-run` / `--yes`), con un cierre extra donde el CLI no pregunta.

| Tipo | Qué hace este servidor |
| --- | --- |
| Lectura | Se ejecuta tal cual. |
| Dry-run (`suggestion edit`, `orders cancel`, direcciones, franja, perfiles, cupones, tarjeta regalo) | Por defecto pasa `--dry-run`. `confirm: true` quita el dry-run y pasa `--yes`. |
| Confirmación del CLI (`subscription pause/resume`, `suggestion pause/resume`) | Esos comandos no tienen `--dry-run`. Sin `confirm`, el CLI arma el resumen y sale con código 2, sin aplicar el cambio. `confirm: true` pasa `--yes`. |
| Confirmación de este servidor (`auth logout`, `config set`) | El CLI no pregunta. Aquí no se lanza el proceso hasta que `confirm` sea `true`. |

`confirm: true` solo debe usarse cuando la persona ha pedido esa operación concreta y ya ha visto el resumen. La respuesta de un simulacro incluye `agent_note` para recordarlo.

Un valor de argumento no puede colarse como flag: los valores van en `--clave=valor` y los posicionales detrás de `--`. Un perfil llamado `--yes` no confirma la operación.

Los códigos de salida del CLI se conservan: 0 correcto, 1 inesperado, 2 uso o confirmación, 3 sesión, 4 red, 5 no encontrado, 6 la API rechazó la operación, 7 el contrato de Wetaca cambió (`contract_drift`).

## Herramientas

La guía embebida del CLI es la herramienta `wetaca_usage` (`wetaca skills get wetaca-usage`). Léela antes de modificar la cuenta.

| Herramienta | Comando del CLI | Efecto |
| --- | --- | --- |
| `wetaca_usage` | `skills get wetaca-usage` | Lectura |
| `wetaca_doctor` | `doctor` | Lectura |
| `wetaca_auth_status` | `auth status` | Lectura |
| `wetaca_auth_logout` | `auth logout` | Exige `confirm` |
| `wetaca_me` | `me` | Lectura |
| `wetaca_subscription_show` | `subscription show` | Lectura |
| `wetaca_subscription_pause` | `subscription pause` | Exige `confirm` |
| `wetaca_subscription_resume` | `subscription resume` | Exige `confirm` |
| `wetaca_suggestion_show` | `suggestion show` | Lectura |
| `wetaca_suggestion_pause` | `suggestion pause` | Exige `confirm` |
| `wetaca_suggestion_resume` | `suggestion resume` | Exige `confirm` |
| `wetaca_suggestion_edit` | `suggestion edit` | Dry-run hasta `confirm` |
| `wetaca_deliveries_next` | `deliveries next` | Lectura |
| `wetaca_deliveries_options` | `deliveries options` | Lectura |
| `wetaca_deliveries_set_option` | `deliveries set-option` | Dry-run hasta `confirm` |
| `wetaca_menu_list` | `menu list` | Lectura |
| `wetaca_dish_show` | `dish show` | Lectura |
| `wetaca_profiles_list` | `profiles list` | Lectura |
| `wetaca_profiles_pause` | `profiles pause` | Dry-run hasta `confirm` |
| `wetaca_profiles_resume` | `profiles resume` | Dry-run hasta `confirm` |
| `wetaca_orders_list` | `orders list` | Lectura |
| `wetaca_orders_show` | `orders show` | Lectura |
| `wetaca_orders_cancel` | `orders cancel` | Dry-run hasta `confirm` |
| `wetaca_addresses_list` | `addresses list` | Lectura |
| `wetaca_addresses_save` | `addresses save` | Dry-run hasta `confirm` |
| `wetaca_addresses_remove` | `addresses remove` | Dry-run hasta `confirm` |
| `wetaca_vouchers_list` | `vouchers list` | Lectura |
| `wetaca_vouchers_current` | `vouchers current` | Lectura |
| `wetaca_vouchers_apply` | `vouchers apply` | Dry-run hasta `confirm` |
| `wetaca_vouchers_skip` | `vouchers skip` | Dry-run hasta `confirm`. La API también pausa la semana; se deshace con `wetaca_suggestion_resume` |
| `wetaca_giftcards_show` | `giftcards show` | Lectura |
| `wetaca_giftcards_redeem` | `giftcards redeem` | Dry-run hasta `confirm` |
| `wetaca_wallet_show` | `wallet` | Lectura |
| `wetaca_config_path` | `config path` | Lectura |
| `wetaca_config_list` | `config list` | Lectura |
| `wetaca_config_get` | `config get` | Lectura |
| `wetaca_config_set` | `config set` | Exige `confirm` |

Quedan fuera, porque el CLI no los hace o no encajan en un chat: login con token, autocompletado del shell, pagos, alta de cuenta, cambiar el método de pago y recargas programadas del monedero.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `WETACA_BIN` | Ejecutable de wetaca, o ruta a su `.js`. Si falta, se usa el `wetaca-cli` de este paquete. |
| `WETACA_TOKEN` | Token de sesión. Tiene prioridad sobre el fichero. No lo subas al repo. |
| `WETACA_REFRESH_TOKEN` | Renovación de sesión sin disco. |
| `WETACA_CONFIG_DIR` | Carpeta de configuración, si no quieres la ruta XDG por defecto. |
| `WETACA_PROFILE` | Perfil de sesión por defecto. Cada herramienta también acepta `profile`. |
| `XDG_CONFIG_HOME` | La respeta wetaca-cli al buscar `wetaca-cli/`. |
| `WETACA_MCP_TIMEOUT_MS` | Tiempo máximo de cada comando. Por defecto 60000. |

El proceso del CLI hereda el entorno del servidor MCP.

## Desarrollo

```bash
npm install
npm test
```

`npm test` compila TypeScript y ejecuta los tests: el argv de cada herramienta, un cliente MCP real por stdio contra la guía embebida de wetaca-cli, y un `wetaca` falso que comprueba que cancelar un pedido no sale de dry-run y que cerrar sesión no arranca el CLI sin `confirm`.

```bash
npm run build
node dist/index.js
```

Eso deja el servidor esperando JSON-RPC por stdin. No abre un puerto. Los logs van a stderr para no mezclarse con el protocolo.

## Publicar en npm

El nombre `wetaca-mcp` estaba libre en el registro al crear este repo. Publicar es un paso aparte, con una cuenta de npm:

```bash
npm test
npm publish --access public
```

Hasta entonces, los clientes tienen que apuntar a `node` y a `dist/index.js`.

## Licencia

MIT. Ver [LICENSE](LICENSE).

wetaca-cli también es MIT. Este proyecto no está afiliado a Wetaca.
