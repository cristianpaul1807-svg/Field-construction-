#!/usr/bin/env python3
"""Que lo que el servidor escucha y lo que Stripe manda sean la misma lista.

    python3 scripts/check-webhook-events.py

Son dos listas en dos ficheros y no se miran entre ellas, que es la forma de
que discrepen sin que nada falle:

- Un evento **manejado y no registrado** no llega nunca. El código está ahí,
  se lee bien, y no se ejecuta jamás. Pasó con `invoice.payment_succeeded`: la
  renovación mensual se cobraba en Stripe y en el sistema no se movía nada, así
  que la pantalla enseñaba la fecha de renovación del mes pasado para siempre.

- Un evento **registrado y no manejado** no rompe nada, pero es ruido: Stripe
  nos despierta para algo que tiramos. Se avisa y no se falla.

Lo que no se puede hacer es descubrirlo probando, porque para verlo hay que
esperar a que Stripe mande ese evento — un mes, en el caso de la renovación.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

api = (RAIZ / "server" / "api.ts").read_text(encoding="utf-8")
setup = (RAIZ / "server" / "stripeWebhookSetup.ts").read_text(encoding="utf-8")

# Lo que el servidor sabe atender.
manejados = set(re.findall(r'event\.type\s*===\s*"([^"]+)"', api))

# Lo que se le pide a Stripe que mande. La lista literal de `const EVENTS`.
bloque = re.search(r"const EVENTS\s*=\s*\[(.*?)\];", setup, re.S)
if not bloque:
    print("no encuentro la lista EVENTS en server/stripeWebhookSetup.ts")
    sys.exit(1)
registrados = set(re.findall(r'"([^"]+)"', bloque.group(1)))

sin_llegar = sorted(manejados - registrados)
sin_atender = sorted(registrados - manejados)

for evento in sin_llegar:
    print(f"FALLA  {evento}: server/api.ts lo maneja y Stripe no lo manda — ese código no se ejecuta nunca")
for evento in sin_atender:
    print(f"aviso  {evento}: se le pide a Stripe y nadie lo atiende")

if sin_llegar:
    sys.exit(1)

print(f"webhook ok — {len(manejados)} eventos manejados, todos registrados" + (f", {len(sin_atender)} de más" if sin_atender else ""))
