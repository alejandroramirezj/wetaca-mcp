import { z } from "zod";
import { flags, positional } from "./args.js";
import type { ToolSpec } from "./types.js";

const profileField = z
  .string()
  .min(1)
  .optional()
  .describe("Perfil de sesión de wetaca-cli (--profile). Si se omite, usa el perfil por defecto.");

const debugField = z
  .boolean()
  .optional()
  .describe("Si es true, wetaca escribe en stderr una línea por petición HTTP (--debug). No incluye el token.");

const confirmField = z
  .boolean()
  .optional()
  .describe(
    "Por defecto false: no hay efectos en la cuenta. true equivale a --yes y ejecuta la operación. " +
      "Úsalo solo si la persona pidió exactamente esta operación y ya vio el resumen.",
  );

const numericId = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/, "Tiene que ser un id numérico"),
]);

const zipcode = z.union([
  z.string().regex(/^\d+$/, "El código postal tiene que ser numérico"),
  z.number().int().nonnegative(),
]);

function readInput(shape: z.ZodRawShape = {}) {
  return z.object({ profile: profileField, debug: debugField, ...shape });
}

function writeInput(shape: z.ZodRawShape = {}) {
  return z.object({ profile: profileField, debug: debugField, confirm: confirmField, ...shape });
}

const CONFIRM_CLI =
  "No tiene --dry-run. Sin confirm, el CLI prepara el resumen y sale con código 2 (confirmation_required) sin aplicar el cambio. confirm:true envía --yes.";

/**
 * Contrato de herramientas, alineado con wetaca-cli 0.2.6
 * (docs/cli-spec.md y `wetaca skills get wetaca-usage`).
 * No añade operaciones que el CLI no tiene. El login con token no es una herramienta:
 * el token no debe pasar por el chat.
 */
export const TOOLS: ToolSpec[] = [
  {
    name: "wetaca_usage",
    title: "Guía de uso",
    description:
      "Guía canónica para agentes, la misma que `wetaca skills get wetaca-usage`. " +
      "Léela antes de cambiar el menú, la suscripción, un pedido, un cupón o una dirección. " +
      "Incluye códigos de salida, reglas de confirmación y flujos típicos. Solo lectura y sin red.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["skills", "get", "wetaca-usage"],
  },
  {
    name: "wetaca_doctor",
    title: "Diagnóstico",
    description:
      "Equivale a `wetaca doctor`. Comprueba Node, si api.wetaca.com responde y si hay sesión. " +
      "Hace una petición de red de diagnóstico. No modifica la cuenta.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["doctor"],
  },
  {
    name: "wetaca_auth_status",
    title: "Estado de la sesión",
    description:
      "Equivale a `wetaca auth status`. Dice si la sesión del perfil es válida. " +
      "Si authenticated es false o el motivo es auth_required, la persona tiene que ejecutar `wetaca auth login` en su terminal. " +
      "No pidas ni pegues tokens, cookies ni contraseñas en el chat. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["auth", "status"],
  },
  {
    name: "wetaca_auth_logout",
    title: "Cerrar sesión",
    description:
      "Equivale a `wetaca auth logout`. Borra el token guardado en el perfil local. " +
      "El CLI no pregunta; este servidor no llama al CLI hasta que confirm sea true. " +
      "Para volver a entrar hace falta `wetaca auth login` en la terminal.",
    safety: "confirm-mcp",
    destructive: true,
    idempotent: true,
    schema: writeInput(),
    command: () => ["auth", "logout"],
  },
  {
    name: "wetaca_me",
    title: "Resumen de la cuenta",
    description:
      "Equivale a `wetaca me`. Resumen de cliente, estado de la suscripción y saldo del monedero. Solo lectura. No muestra tarjetas.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["me", "show"],
  },
  {
    name: "wetaca_subscription_show",
    title: "Ver suscripción",
    description:
      "Equivale a `wetaca subscription show`. Suscripción completa: perfiles, entrega, precio y próxima sugerencia. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["subscription", "show"],
  },
  {
    name: "wetaca_subscription_pause",
    title: "Pausar suscripción",
    description:
      "Equivale a `wetaca subscription pause`. Pausa la suscripción. " +
      "Con weeks (entero ≥ 1) es una pausa de N semanas; sin weeks es indefinida y se reactiva con wetaca_subscription_resume. " +
      CONFIRM_CLI +
      " Opcional: feedback.",
    safety: "confirm-cli",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      weeks: z.number().int().min(1).optional().describe("Semanas de pausa. Si se omite, la pausa es indefinida."),
      feedback: z.string().min(1).optional().describe("Comentario opcional que el CLI envía con la pausa (--feedback)."),
    }),
    command: (input) => ["subscription", "pause", ...flags([["weeks", input.weeks], ["feedback", input.feedback]])],
  },
  {
    name: "wetaca_subscription_resume",
    title: "Reanudar suscripción",
    description:
      "Equivale a `wetaca subscription resume`. Reactiva una suscripción pausada. " +
      "Si ya está activa, el CLI responde alreadyActive sin volver a activarla. " +
      CONFIRM_CLI,
    safety: "confirm-cli",
    destructive: false,
    idempotent: true,
    schema: writeInput(),
    command: () => ["subscription", "resume"],
  },
  {
    name: "wetaca_suggestion_show",
    title: "Ver menú de la semana",
    description:
      "Equivale a `wetaca suggestion show`. Menú de la próxima semana por perfil: precios, ventana de entrega y los ids " +
      "(profileSuggestionId, productId) que hacen falta para wetaca_suggestion_edit. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["suggestion", "show"],
  },
  {
    name: "wetaca_suggestion_pause",
    title: "Saltar la semana",
    description:
      "Equivale a `wetaca suggestion pause`. Salta la entrega de la próxima semana. La semana ya cobrada no se toca. " +
      CONFIRM_CLI +
      " Opcional: feedback y suggestion (id; si falta, el CLI usa la próxima).",
    safety: "confirm-cli",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      suggestion: z.string().min(1).optional().describe("Id de la sugerencia (--suggestion). Si falta, la próxima semana."),
      feedback: z.string().min(1).optional().describe("Comentario opcional (--feedback)."),
    }),
    command: (input) => [
      "suggestion",
      "pause",
      ...flags([["suggestion", input.suggestion], ["feedback", input.feedback]]),
    ],
  },
  {
    name: "wetaca_suggestion_resume",
    title: "Reactivar la semana",
    description:
      "Equivale a `wetaca suggestion resume`. Vuelve a activar la entrega de la próxima semana si estaba saltada. " +
      "También deshace el efecto de wetaca_vouchers_skip. " +
      CONFIRM_CLI,
    safety: "confirm-cli",
    destructive: false,
    idempotent: true,
    schema: writeInput({
      suggestion: z.string().min(1).optional().describe("Id de la sugerencia (--suggestion). Si falta, la próxima semana."),
    }),
    command: (input) => ["suggestion", "resume", ...flags([["suggestion", input.suggestion]])],
  },
  {
    name: "wetaca_suggestion_edit",
    title: "Editar el menú",
    description:
      "Equivale a `wetaca suggestion edit --profile-suggestion ID --set \"id:cantidad,...\"`. " +
      "Cambia los tuppers de un perfil en la próxima semana. Los ids salen de wetaca_suggestion_show o wetaca_menu_list. " +
      "set es una lista `productId:cantidad` separada por comas; la cantidad es un entero ≥ 0. " +
      "Por defecto --dry-run (devuelve wouldSend y no cambia el menú). confirm:true envía --yes. " +
      "resume opcional se traduce a --resume=true|false, igual que el CLI.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      profile_suggestion: z.string().min(1).describe("profileSuggestionId del perfil dentro de la sugerencia."),
      set: z.string().min(3).describe('Pares productId:cantidad, por ejemplo "123:2,456:1".'),
      resume: z.boolean().optional().describe("Si se informa, se pasa --resume=true o --resume=false al CLI."),
    }),
    command: (input) => [
      "suggestion",
      "edit",
      ...flags([
        ["profile-suggestion", input.profile_suggestion],
        ["set", input.set],
        ["resume", input.resume],
      ]),
    ],
  },
  {
    name: "wetaca_deliveries_next",
    title: "Próximas entregas",
    description:
      "Equivale a `wetaca deliveries next`. Sugerencias y pedidos pendientes, con los ids que usan wetaca_orders_cancel. " +
      "Si nextPaymentPendingOrder no es null, hay un pago pendiente: este servidor no lo cobra; se paga en wetaca.com. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["deliveries", "next"],
  },
  {
    name: "wetaca_deliveries_options",
    title: "Franjas de entrega",
    description:
      "Equivale a `wetaca deliveries options`. Franjas horarias disponibles para el código postal de la suscripción, " +
      "o para el zipcode que pases. Marca cuál es la actual. Solo lectura. El id se usa en wetaca_deliveries_set_option.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      zipcode: zipcode.optional().describe("Código postal (--zipcode). Si falta, el CLI usa el de la suscripción."),
    }),
    command: (input) => ["deliveries", "options", ...flags([["zipcode", input.zipcode]])],
  },
  {
    name: "wetaca_deliveries_set_option",
    title: "Cambiar franja",
    description:
      "Equivale a `wetaca deliveries set-option <id>`. Cambia la franja de entrega de la suscripción y de la próxima semana. " +
      "El id sale de wetaca_deliveries_options. Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      option_id: numericId.describe("Id numérico de la franja (wetaca deliveries options)."),
    }),
    command: (input) => positional(["deliveries", "set-option"], [input.option_id]),
  },
  {
    name: "wetaca_menu_list",
    title: "Carta de la semana",
    description:
      "Equivale a `wetaca menu list`. Platos de la semana y sus ids, para construir el --set de wetaca_suggestion_edit. " +
      "zipcode es opcional. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      zipcode: zipcode.optional().describe("Código postal (--zipcode). Si falta, el CLI usa el de la cuenta."),
    }),
    command: (input) => ["menu", "list", ...flags([["zipcode", input.zipcode]])],
  },
  {
    name: "wetaca_dish_show",
    title: "Ficha de un plato",
    description:
      "Equivale a `wetaca dish show <slug>`. Detalle e ingredientes de un plato. El slug sale de wetaca_menu_list. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      slug: z.string().min(1).describe("Slug del plato, tal como lo devuelve wetaca_menu_list."),
    }),
    command: (input) => positional(["dish", "show"], [input.slug]),
  },
  {
    name: "wetaca_profiles_list",
    title: "Listar perfiles",
    description:
      "Equivale a `wetaca profiles list`. Perfiles de la suscripción (id, nombre, menú). Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["profiles", "list"],
  },
  {
    name: "wetaca_profiles_pause",
    title: "Pausar perfil",
    description:
      "Equivale a `wetaca profiles pause <id|nombre>`. Deja de enviar tuppers a ese perfil. " +
      "Acepta el id o el nombre. Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      profile_ref: z.string().min(1).describe("Id o nombre del perfil, como en wetaca_profiles_list."),
    }),
    command: (input) => positional(["profiles", "pause"], [input.profile_ref]),
  },
  {
    name: "wetaca_profiles_resume",
    title: "Reanudar perfil",
    description:
      "Equivale a `wetaca profiles resume <id|nombre>`. Vuelve a activar un perfil pausado. " +
      "Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: false,
    idempotent: true,
    schema: writeInput({
      profile_ref: z.string().min(1).describe("Id o nombre del perfil, como en wetaca_profiles_list."),
    }),
    command: (input) => positional(["profiles", "resume"], [input.profile_ref]),
  },
  {
    name: "wetaca_orders_list",
    title: "Historial de pedidos",
    description:
      "Equivale a `wetaca orders list`. Pedidos anteriores. limit por defecto 10 en el CLI; offset por defecto 0. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      limit: z.number().int().positive().optional().describe("Máximo de pedidos (--limit). El CLI usa 10 si falta."),
      offset: z.number().int().nonnegative().optional().describe("Desplazamiento (--offset). El CLI usa 0 si falta."),
    }),
    command: (input) => ["orders", "list", ...flags([["limit", input.limit], ["offset", input.offset]])],
  },
  {
    name: "wetaca_orders_show",
    title: "Detalle de pedido",
    description: "Equivale a `wetaca orders show <id>`. Detalle de un pedido numérico. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      order_id: numericId.describe("Id numérico del pedido."),
    }),
    command: (input) => positional(["orders", "show"], [input.order_id]),
  },
  {
    name: "wetaca_orders_cancel",
    title: "Cancelar pedido",
    description:
      "Equivale a `wetaca orders cancel <id>`. Cancela un pedido confirmado y devuelve el importe. " +
      "El id sale de wetaca_deliveries_next (pendientes) o wetaca_orders_list (historial). " +
      "Por defecto --dry-run, sin efectos. confirm:true envía --yes y cancela de verdad. No toca tarjetas ni pagos pendientes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      order_id: numericId.describe("Id numérico del pedido a cancelar."),
    }),
    command: (input) => positional(["orders", "cancel"], [input.order_id]),
  },
  {
    name: "wetaca_addresses_list",
    title: "Listar direcciones",
    description: "Equivale a `wetaca addresses list`. Direcciones guardadas. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["addresses", "list"],
  },
  {
    name: "wetaca_addresses_save",
    title: "Guardar dirección de entrega",
    description:
      "Equivale a `wetaca addresses save`. Crea la dirección y la asigna a la suscripción y a la próxima semana " +
      "(el mismo flujo que la web: saveAddress, editDeliveryAccountInfo, editSuggestionDelivery). " +
      "Obligatorios: street, number, zipcode, city. Opcionales: floor, notes, firstname, lastname, phone; " +
      "si faltan, el CLI hereda los de la dirección actual. Por defecto --dry-run. " +
      "Cada ejecución real crea una dirección nueva: no es idempotente. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      street: z.string().min(1).describe("Calle (--street)."),
      number: z.string().min(1).describe("Número (--number). El CLI lo trata como texto."),
      zipcode: zipcode.describe("Código postal numérico (--zipcode)."),
      city: z.string().min(1).describe("Ciudad (--city)."),
      floor: z.string().min(1).optional().describe("Piso (--floor)."),
      notes: z.string().min(1).optional().describe("Notas para el repartidor (--notes)."),
      firstname: z.string().min(1).optional().describe("Nombre (--firstname). Si falta, se hereda."),
      lastname: z.string().min(1).optional().describe("Apellidos (--lastname). Si falta, se hereda."),
      phone: z.string().min(1).optional().describe("Teléfono (--phone). Si falta, se hereda."),
    }),
    command: (input) => [
      "addresses",
      "save",
      ...flags([
        ["street", input.street],
        ["number", input.number],
        ["floor", input.floor],
        ["zipcode", input.zipcode],
        ["city", input.city],
        ["notes", input.notes],
        ["firstname", input.firstname],
        ["lastname", input.lastname],
        ["phone", input.phone],
      ]),
    ],
  },
  {
    name: "wetaca_addresses_remove",
    title: "Borrar dirección",
    description:
      "Equivale a `wetaca addresses remove <id>`. Borra una dirección que no esté en uso. " +
      "Si es la de la suscripción o la de la semana, el CLI se niega: primero hay que asignar otra con wetaca_addresses_save. " +
      "Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      address_id: numericId.describe("Id numérico de la dirección (wetaca addresses list)."),
    }),
    command: (input) => positional(["addresses", "remove"], [input.address_id]),
  },
  {
    name: "wetaca_vouchers_list",
    title: "Listar cupones",
    description: "Equivale a `wetaca vouchers list`. Cupones de la cuenta. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["vouchers", "list"],
  },
  {
    name: "wetaca_vouchers_current",
    title: "Cupón de la semana",
    description:
      "Equivale a `wetaca vouchers current`. Cupón aplicado a la próxima semana, si hay alguno. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["vouchers", "current"],
  },
  {
    name: "wetaca_vouchers_apply",
    title: "Aplicar cupón",
    description:
      "Equivale a `wetaca vouchers apply <CODE>`. Aplica un cupón a la entrega de la próxima semana. " +
      "Por defecto --dry-run. confirm:true envía --yes. No canjea tarjetas regalo: para eso está wetaca_giftcards_redeem.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      code: z.string().min(1).describe("Código del cupón."),
      suggestion: z.string().min(1).optional().describe("Id de la sugerencia (--suggestion). Si falta, la próxima semana."),
    }),
    command: (input) => positional(["vouchers", "apply", ...flags([["suggestion", input.suggestion]])], [input.code]),
  },
  {
    name: "wetaca_vouchers_skip",
    title: "No usar cupón",
    description:
      "Equivale a `wetaca vouchers skip`. AVISO del propio CLI: la API lo implementa como skipVoucher=true y TAMBIÉN " +
      "pausa la entrega de la próxima semana, el mismo efecto que wetaca_suggestion_pause. " +
      "Se deshace con wetaca_suggestion_resume. Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      suggestion: z.string().min(1).optional().describe("Id de la sugerencia (--suggestion). Si falta, la próxima semana."),
    }),
    command: (input) => ["vouchers", "skip", ...flags([["suggestion", input.suggestion]])],
  },
  {
    name: "wetaca_giftcards_show",
    title: "Límites de tarjeta regalo",
    description:
      "Equivale a `wetaca giftcards show`. Importes mínimo y máximo de las tarjetas regalo. Solo lectura. No muestra ni cobra tarjetas de pago.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["giftcards", "show"],
  },
  {
    name: "wetaca_giftcards_redeem",
    title: "Canjear tarjeta regalo",
    description:
      "Equivale a `wetaca giftcards redeem <CODE>`. Ingresa el saldo de una tarjeta regalo en el monedero. " +
      "No es un pago con tarjeta bancaria. Por defecto --dry-run. confirm:true envía --yes.",
    safety: "dry-run",
    destructive: true,
    idempotent: false,
    schema: writeInput({
      code: z.string().min(1).describe("Código de la tarjeta regalo."),
    }),
    command: (input) => positional(["giftcards", "redeem"], [input.code]),
  },
  {
    name: "wetaca_wallet_show",
    title: "Saldo del monedero",
    description:
      "Equivale a `wetaca wallet`. Saldo del monedero, en céntimos y en euros. Solo lectura. No recarga el monedero ni gestiona pagos.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["wallet", "show"],
  },
  {
    name: "wetaca_config_path",
    title: "Ruta de la configuración",
    description:
      "Equivale a `wetaca config path`. Rutas de config.json y credentials.json. No devuelve el contenido de los secretos. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["config", "path"],
  },
  {
    name: "wetaca_config_list",
    title: "Ver configuración",
    description:
      "Equivale a `wetaca config list`. Configuración pública del CLI. Los tokens no se muestran. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput(),
    command: () => ["config", "list"],
  },
  {
    name: "wetaca_config_get",
    title: "Leer una clave",
    description:
      "Equivale a `wetaca config get <clave>`. Lee una clave con puntos, por ejemplo defaultProfile. " +
      "Si la clave acaba en token, el CLI devuelve ***. Solo lectura.",
    safety: "read",
    destructive: false,
    idempotent: true,
    schema: readInput({
      key: z.string().min(1).describe("Clave, con puntos si hace falta (config get <clave>)."),
    }),
    command: (input) => positional(["config", "get"], [input.key]),
  },
  {
    name: "wetaca_config_set",
    title: "Cambiar configuración",
    description:
      "Equivale a `wetaca config set <clave> <valor>`. Escribe config.json. " +
      "El CLI no pregunta y rechaza las claves que acaban en token (el token solo entra con `wetaca auth login`). " +
      "Este servidor no llama al CLI hasta que confirm sea true. " +
      "Los valores true y false se guardan como booleanos, igual que en el CLI.",
    safety: "confirm-mcp",
    destructive: true,
    idempotent: true,
    schema: writeInput({
      key: z.string().min(1).describe("Clave a escribir. No puede acabar en token."),
      value: z.string().min(1).describe("Valor. true y false se convierten en booleanos."),
    }),
    command: (input) => positional(["config", "set"], [input.key, input.value]),
  },
];

export function toolByName(name: string): ToolSpec | undefined {
  return TOOLS.find((tool) => tool.name === name);
}
