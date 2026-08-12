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
npm run build                         # must succeed
python3 scripts/check-route-gate.py   # every route on its correct side
```

Then check locale parity (`docs/desarrollo/idiomas.md`) and, for anything
user-visible, look at it in a browser. Screenshots caught real layout bugs
in this project that typechecking never would.

Deployment reads from `main`. Merge there when the work is verified.
