# Working in this repository

An all-in-one management platform for construction businesses, built for the
Canadian market (Quebec first: GST/QST, RBQ licence numbers, 10% holdback).
Four audiences share one deployment — the business panel, the client portal,
the field-worker PWA, and the public button-flow chat — and each authenticates
differently. That is the single most important thing to understand before
changing anything.

**Read `docs/README.md` first.** It indexes a step-by-step guide for every
function in the product. When you don't know how something works, or how to
add something, the answer is in `docs/`, not in guesswork.

## Stack

React 19 + Vite 7 + TypeScript, wouter for routing, Tailwind v4 with
shadcn/radix-ui primitives, lucide-react icons. Express API in `server/`,
Supabase Postgres with row-level security. i18next for four languages.

There is no local database and no migration files. The schema lives in the
live Supabase project and is changed through the Supabase MCP tools
(`apply_migration` for DDL, `execute_sql` for queries).

## The four ways in

| Surface | Route | Credential | Middleware |
|---|---|---|---|
| Business panel | everything unmatched | Supabase Auth session | `requireBusinessAuth` |
| Client portal | `/portal` | Supabase session **or** access code | `requireClientAuth` |
| Field worker PWA | `/campo` | access code only | `requireWorkerAuth` |
| Public chat | `/c/:slug` | none | none |

`server/api.ts` mounts `apiRouter.use(requireBusinessAuth)` partway down the
file. **Every route registered above that line is public or brings its own
middleware; everything below it is the business panel.** Registering a
client-portal or public route below that line silently breaks it with a 401 —
this has happened before. When you add a route, check which side of the gate
it lands on.

Workers have no `auth.uid()`, so worker routes use `getSupabaseAdmin()` with
explicit `.eq("business_id", …)` filtering instead of relying on RLS. Client
routes do the same wherever a client may have arrived by access code.

## Conventions that matter

**Comments explain why, not what.** The codebase reads as prose about
decisions: why a value is folded in, why a check exists, what would break
without it. Match that. Don't narrate what the next line obviously does.

**No dead controls.** A button that does nothing is worse than no button. If
something genuinely cannot work (it needs a credential the business must
obtain themselves), say so in the UI and offer the thing that does work —
see `client/src/pages/SettingsWhatsapp.tsx` for the pattern.

**Four languages, always at parity.** Every user-visible string goes through
`t()`. `client/src/i18n/locales/{es,en,fr,it}.json` must contain exactly the
same key set, with no empty values. See `docs/desarrollo/idiomas.md` for the
helper script and the verification step.

**Stored values are never translated.** Status columns hold their Spanish
slugs (`en_progreso`, `mano_obra`) because that is the data. Translate at
display time with `t(\`group.${value}\`)`. Never translate on write.

**Money is rounded once, at the point it becomes a number a person sees.**
`Math.round(x * 100) / 100`. Tax is computed on the full value of the work;
only the payment is reduced by a holdback.

## Before you finish

```bash
npx tsc --noEmit                      # must be silent
npm run build                         # client AND server — not just `vite build`
python3 scripts/check-route-gate.py   # every route on its correct side
python3 scripts/check-help-menu.py    # help answers name screens via {{menu…}}
python3 scripts/check-webhook-events.py  # every handled Stripe event is one Stripe sends
python3 scripts/check-errores-traducidos.py  # every server error code has a sentence in all four
python3 scripts/check-idioma-respaldo.py  # every language picker falls back to the same one
python3 scripts/check-pantallas-area.py  # no panel screen ships without an area
node scripts/comprobar-ancho.mjs      # no public page scrolls sideways on a phone
node scripts/comprobar-ancho-panel.mjs  # nor does any panel screen, open cards included
node --experimental-strip-types scripts/prueba-suscripcion/mapeo.mjs    # Stripe payload -> what we store
node --experimental-strip-types scripts/prueba-suscripcion/bloqueo.mjs  # when the trial ends, and what stays open
node --experimental-strip-types scripts/prueba-mcp/roles.mjs            # MCP never opens what the panel closes
node --experimental-strip-types scripts/prueba-mcp/idiomas.mjs          # the MCP consent page speaks all four
```

`npm run build` is the marketing site generator, then `vite build`, then
`esbuild server/…`. Running only `vite build` checks the client and silently
skips the server bundle — which is the half that has to boot in production.

Both width checks read what the build wrote, so they go **after** it. They open
every page at 320 and 390 px and fail if anything is wider than the screen —
the failure that makes a page draggable sideways on a phone, which is where
this gets read.

`comprobar-ancho.mjs` covers the 28 public pages, with the real fonts.
`comprobar-ancho-panel.mjs` covers the 31 panel screens, which need a session:
it serves `dist/public`, answers any read of the Supabase session key with a
fake one, and replies to every `/api/…` from a fixture table. Three things
about it are load-bearing, and each is there because its absence produced a
green run that had measured nothing:

- It asserts it landed on the screen it asked for. The first version seeded a
  session under a guessed storage key, never logged in, and passed 62 times on
  the login page.
- It fails if a screen renders the error boundary. A crash notice fits on any
  phone, so three screens whose fixtures had the wrong shape were passing.
- It opens each card in `main` one at a time and measures each open state. The
  bug that prompted all this was inside a card you have to expand.

**The fixtures carry long names, long emails and five-figure amounts on
purpose.** An empty list always fits; what breaks a row is real data. If you
add a screen whose API returns an object, give it a fixture — the default is
`[]`, and a screen that expected an object will crash instead of being
measured. The guard will tell you which one.

Then check locale parity (`docs/desarrollo/idiomas.md`) and, for anything
user-visible, look at it in a browser. Screenshots caught real layout bugs
in this project that typechecking never would — and so did measuring: the
header overflowed on a phone while every automated check said it was fine,
because nothing was measuring the rendered page.

Deployment reads from `main`. Merge there when the work is verified.
