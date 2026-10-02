/**
 * Crea (o pone al día) nuestros dos productos, sus cuatro precios y el portal
 * del cliente en Stripe.
 *
 *   STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs
 *   STRIPE_SECRET_KEY=sk_test_… node --experimental-strip-types scripts/stripe-precios.mjs --dry
 *
 * Existe porque hacerlo a mano en el panel de Stripe se hace mal una vez de
 * cada tres, y la forma de hacerlo mal no da ningún error: un precio sin su
 * `lookup_key` deja la pasarela contestando «en Stripe no hay ningún precio
 * activo con la clave chantier_mes», y un `metadata.plan` mal escrito deja
 * cobrando de verdad y sin abrirle el plan a quien pagó.
 *
 * Y porque hay que hacerlo **dos veces**: una en la cuenta de pruebas y otra
 * en la real. Dos veces a mano son dos oportunidades de que no coincidan.
 *
 * Se puede volver a correr cuantas veces haga falta:
 *
 * - Si el producto ya está, lo reutiliza; no crea uno segundo.
 * - Si el precio ya está y **cuesta lo mismo**, no toca nada.
 * - Si el precio ya está y cuesta otra cosa, crea el nuevo y **le traslada la
 *   clave de búsqueda**. Los precios de Stripe no se editan: cambiar 99 por
 *   109 es crear otro. El viejo se queda archivado, que es lo correcto —
 *   quien ya paga 99 sigue pagando 99 hasta que decida cambiarse.
 */

import Stripe from "stripe";
import { PRECIOS, MONEDAS_DE_COBRO, PLANES_DE_PAGO, PERIODOS, claveDelPrecio } from "../shared/planes.ts";

const CLAVE = process.env.STRIPE_SECRET_KEY?.trim();
const ENSAYO = process.argv.includes("--dry");

if (!CLAVE) {
  console.error("Falta STRIPE_SECRET_KEY.\n");
  console.error("  STRIPE_SECRET_KEY=sk_live_… node --experimental-strip-types scripts/stripe-precios.mjs");
  process.exit(1);
}

const EN_VIVO = CLAVE.startsWith("sk_live_");

/**
 * Lo que se lee en la pasarela y en el recibo. No es documentación interna.
 *
 * Uno por moneda, porque cada moneda es un mercado: a un contratista de Roma
 * no se le habla de TPS y TVQ. Por eso los euros tienen sus propios productos
 * (con `metadata.moneda`) en vez de colgar sus precios de los de Canadá.
 */
const DESCRIPCIONES = {
  EUR: {
    chantier:
      "Cantieri, ordini di lavoro e agenda. Timbratura con GPS e foto dal cantiere. " +
      "Preventivi firmati dal telefono. Fatture con IVA e XML FatturaPA, SAL per voci, " +
      "bonifico parlante per i bonus edilizi, scadenze di DURC e corsi. Portale del cliente. " +
      "Fino a 2 persone in ufficio, operai illimitati.",
    entreprise:
      "Tutto di Chantier, piu: congruita della manodopera e margine per cantiere in tempo reale, " +
      "esportazioni per il commercialista, report. Accessi limitati per ruolo. " +
      "Persone in ufficio senza limite.",
  },
};
const DESCRIPCION = {
  chantier:
    "Obras, ordenes de trabajo y agenda. Fichaje con GPS y fotos desde la obra. " +
    "Presupuestos firmados desde el movil. Facturas con TPS y TVQ y retencion del 10%. " +
    "Cobro con tarjeta y portal del cliente. Hasta 2 personas en la oficina, " +
    "trabajadores de campo ilimitados.",
  entreprise:
    "Todo lo de Chantier, mas: nominas, T4 y acuerdos de trabajo. Informe mensual de la CCQ. " +
    "Margen por obra en tiempo real. Contabilidad enganchada a QuickBooks. Reportes. " +
    "Accesos limitados por rol. Personas en la oficina sin limite.",
};

const stripe = new Stripe(CLAVE);

/** Donde vive el producto. Lo leen el portal y sus enlaces legales. */
const SITIO = "https://logiciel-construction.com";

/**
 * Las páginas legales llevan el idioma en la ruta.
 *
 * El portal apuntaba a `/confidentialite` y `/conditions` a secas, y esas no
 * existen: caen en el armazón de la aplicación y sirven el index. O sea que
 * quien entraba a cancelar y pulsaba «política de privacidad» veía una
 * pantalla en blanco de la app en vez de la política — en el sitio donde
 * menos conviene hacer dudar a alguien, y donde además mira Stripe cuando
 * revisa la cuenta.
 *
 * En francés porque el portal saluda en francés y el mercado es Quebec. Las
 * otras tres existen igual: `/en/privacy`, `/es/privacidad`, `/it/privacy`.
 */
const LEGAL = {
  privacidad: `${SITIO}/fr/confidentialite`,
  condiciones: `${SITIO}/fr/conditions`,
};

function decir(estado, texto) {
  const marca = { nuevo: "+", igual: "=", cambia: "~" }[estado] ?? " ";
  console.log(`  ${marca} ${texto}`);
}

/** El producto del plan en una moneda, buscándolo por su etiqueta y no por el nombre. */
async function producto(plan, moneda) {
  // Por `metadata.plan` y no por nombre: el nombre es texto que alguien puede
  // cambiar en el panel para que se lea mejor en un recibo, y entonces este
  // script crearía un producto duplicado sin que nada fallara. Los de Canadá
  // nacieron sin `metadata.moneda`: sin ella, son los de CAD.
  const todos = await stripe.products.list({ active: true, limit: 100 });
  const suyo = todos.data.find((p) => p.metadata?.plan === plan && (p.metadata?.moneda ?? "CAD") === moneda);

  if (suyo) {
    decir("igual", `producto ${plan} ${moneda} — ${suyo.id}`);
    return suyo;
  }
  if (ENSAYO) {
    decir("nuevo", `producto ${plan} ${moneda} (ensayo, no se crea)`);
    return { id: `ensayo_${plan}_${moneda}` };
  }
  const creado = await stripe.products.create({
    name: plan === "chantier" ? "Chantier" : "Entreprise",
    description: (DESCRIPCIONES[moneda] ?? DESCRIPCION)[plan],
    metadata: { plan, moneda },
  });
  decir("nuevo", `producto ${plan} ${moneda} — ${creado.id}`);
  return creado;
}

async function precio(plan, periodo, monedaDeCobro, productoId) {
  const clave = claveDelPrecio(plan, periodo, monedaDeCobro);
  const tarifa = PRECIOS[monedaDeCobro][plan];
  const importe = Math.round((periodo === "mes" ? tarifa.mes : tarifa.ano) * 100);
  const intervalo = periodo === "mes" ? "month" : "year";
  const moneda = tarifa.moneda.toLowerCase();

  const existentes = await stripe.prices.list({ lookup_keys: [clave], active: true, limit: 1 });
  const actual = existentes.data[0];

  if (
    actual &&
    actual.unit_amount === importe &&
    actual.currency === moneda &&
    actual.recurring?.interval === intervalo
  ) {
    decir("igual", `${clave} — ${importe / 100} ${moneda.toUpperCase()} — ${actual.id}`);
    return actual.id;
  }

  if (ENSAYO) {
    decir(actual ? "cambia" : "nuevo", `${clave} — ${importe / 100} ${moneda.toUpperCase()} (ensayo, no se crea)`);
    return null;
  }

  const creado = await stripe.prices.create({
    product: productoId,
    currency: moneda,
    unit_amount: importe,
    recurring: { interval: intervalo },
    // Los impuestos por encima del precio, que es lo que dice el sitio. Si
    // algún día no hay que cobrarlos, se cambia aquí y en el sitio a la vez.
    tax_behavior: "exclusive",
    nickname: `${plan} ${periodo}`,
    lookup_key: clave,
    // Si había uno con esta clave, se la quita y se la queda este. El viejo se
    // queda vivo para quien ya lo estaba pagando.
    transfer_lookup_key: Boolean(actual),
    metadata: { plan, periodo, moneda: monedaDeCobro },
  });
  decir(actual ? "cambia" : "nuevo", `${clave} — ${importe / 100} ${moneda.toUpperCase()} — ${creado.id}`);
  if (actual) decir(" ", `   el anterior (${actual.id}) sigue vivo para quien ya lo paga`);
  return creado.id;
}

/**
 * El portal del cliente: cancelar, cambiar de plan, la tarjeta y las facturas.
 *
 * Sin una configuración guardada, `billingPortal.sessions.create` falla — y
 * falla justo en el botón de cancelar, que es lo primero que mira quien se
 * plantea pagar. En la cuenta real no había ninguna y no la crea ningún
 * código: se hace una vez, a mano, en un panel que nadie vuelve a abrir. Por
 * eso está aquí, con los precios, y no en una nota.
 *
 * La cancelación es **al final del periodo**. Ya pagó ese mes: cortarle a
 * mitad sería quedarnos con dinero por un servicio que no da.
 */
async function portal(productos) {
  const existentes = await stripe.billingPortal.configurations.list({ active: true, limit: 10 });
  const suya = existentes.data.find((c) => c.is_default);
  if (suya) {
    // Ya existe, pero tiene que conocer los productos de cada moneda: sin
    // ellos, quien paga en euros no puede pasar de Chantier a Entreprise desde
    // el portal. Stripe sólo le enseña los precios de su moneda.
    const tiene = new Set((suya.features?.subscription_update?.products ?? []).map((p) => p.product));
    const faltan = productos.filter((p) => !tiene.has(p.product));
    if (faltan.length === 0 || ENSAYO) {
      decir(faltan.length ? "cambia" : "igual", `portal del cliente — ${suya.id}${faltan.length ? " (ensayo, no se toca)" : ""}`);
      return;
    }
    await stripe.billingPortal.configurations.update(suya.id, {
      features: { subscription_update: { enabled: true, default_allowed_updates: ["price", "promotion_code"], proration_behavior: "create_prorations", products: productos } },
    });
    decir("cambia", `portal del cliente — ${suya.id}, ahora con ${productos.length} productos`);
    return;
  }
  if (ENSAYO) {
    decir("nuevo", "portal del cliente (ensayo, no se crea)");
    return;
  }

  const creada = await stripe.billingPortal.configurations.create({
    name: "Logiciel Construction — suscripción del negocio",
    default_return_url: `${SITIO}/suscripcion`,
    business_profile: {
      headline: "Logiciel Construction — votre abonnement",
      privacy_policy_url: LEGAL.privacidad,
      terms_of_service_url: LEGAL.condiciones,
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      // `tax_id` porque un contratista de Quebec necesita su TPS/TVQ en la
      // factura que nos paga. `shipping` no: aquí no se envía nada.
      customer_update: { enabled: true, allowed_updates: ["address", "email", "name", "phone", "tax_id"] },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: ["too_expensive", "missing_features", "switched_service", "unused", "customer_service", "too_complex", "other"],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price", "promotion_code"],
        // Cambiar de Chantier a Entreprise a mitad de mes se cobra la
        // diferencia, no el mes entero otra vez.
        proration_behavior: "create_prorations",
        products: productos,
      },
    },
  });
  decir("nuevo", `portal del cliente — ${creada.id}`);
}

async function main() {
  console.log(`\nCuenta: ${EN_VIVO ? "REAL — esto cobra dinero de verdad" : "de pruebas"}${ENSAYO ? "  ·  ENSAYO, no se escribe nada" : ""}\n`);

  const productos = [];
  for (const moneda of MONEDAS_DE_COBRO) {
    for (const plan of PLANES_DE_PAGO) {
      const p = await producto(plan, moneda);
      const precios = [];
      for (const periodo of PERIODOS) precios.push(await precio(plan, periodo, moneda, p.id));
      if (!ENSAYO) productos.push({ product: p.id, prices: precios.filter(Boolean) });
    }
  }

  await portal(productos);

  const n = MONEDAS_DE_COBRO.length;
  console.log(`\nlisto — ${n * PLANES_DE_PAGO.length} productos, ${n * PLANES_DE_PAGO.length * PERIODOS.length} precios (${MONEDAS_DE_COBRO.join(" y ")}), portal del cliente\n`);

  if (EN_VIVO && !ENSAYO) {
    console.log("Queda por hacer, y no lo hace esto:");
    console.log("  1. STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET reales en el hosting.");
    console.log("  2. Volver a provisionar el webhook (POST /api/stripe/webhook/provision),");
    console.log("     o Stripe seguirá mandando sólo los dos eventos de Connect y el plan");
    console.log("     del negocio no cambiará nunca al pagar.");
    console.log("  3. Que la cuenta tenga métodos de pago activados para CAD, o que el");
    console.log("     checkout siga pidiendo `payment_method_types: [\"card\"]` a mano.");
    console.log("  4. Un cobro de verdad, con una tarjeta de verdad, y mirar que el plan");
    console.log("     cambie en Ajustes → Suscripción.\n");
  }
}

main().catch((err) => {
  console.error("\nno se pudo:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
