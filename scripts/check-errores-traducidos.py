#!/usr/bin/env python3
"""Que cada error del servidor tenga frase en los cuatro idiomas.

    python3 scripts/check-errores-traducidos.py

El servidor no manda texto traducido: manda un **código estable** y el cliente
lo convierte en `serverErrors.<código>` en el idioma de quien mira. Es el
reparto correcto — el servidor no sabe en qué idioma está leyendo nadie — pero
tiene un agujero silencioso: si el código llega y nadie le escribió texto,
`anuncioDeFallo` baja al mensaje genérico del estado HTTP.

O sea, no se rompe nada y no sale castellano crudo. Lo que se pierde es lo
único que valía: «este trabajador tiene horas registradas, dale de baja en vez
de borrarlo» se convierte en «no se pudo». La frase que decía qué hacer
desaparece y queda la que no dice nada, y nadie se entera, porque el fallo es
que algo *no* aparezca.

Había 80 códigos y 39 sin escribir cuando se hizo esta comprobación.

Los de `server/mcp.ts` no cuentan: esos los lee Claude por MCP y no llegan a
ninguna pantalla. La persona lee lo que Claude le cuente, en su idioma.
"""

import json
import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
IDIOMAS = ["es", "en", "fr", "it"]

# Lo que el servidor contesta cuando algo va mal, en las tres formas que tiene
# de decirlo. `code:` suelto no vale: la nómina también usa esa palabra para
# las claves de las deducciones (rrq, cnesst, fss) y no son errores.
PATRONES = [
    re.compile(r'json\(\{[^}]*\bcode:\s*"([a-z0-9_]+)"'),
    re.compile(r'new CodedError\(\s*"([a-z0-9_]+)"'),
]

codigos: dict[str, set[str]] = {}
for fuente in sorted((RAIZ / "server").glob("*.ts")):
    texto = fuente.read_text(encoding="utf-8")
    for patron in PATRONES:
        for codigo in patron.findall(texto):
            codigos.setdefault(codigo, set()).add(fuente.name)

# Los que sólo salen por MCP no los lee una persona.
de_pantalla = {c: d for c, d in codigos.items() if d != {"mcp.ts"}}
solo_mcp = len(codigos) - len(de_pantalla)

fallos = []
for idioma in IDIOMAS:
    tabla = json.loads((RAIZ / "client" / "src" / "i18n" / "locales" / f"{idioma}.json").read_text(encoding="utf-8"))
    escritos = tabla.get("serverErrors", {})
    for codigo in sorted(de_pantalla):
        if not str(escritos.get(codigo, "")).strip():
            fallos.append(f"{idioma}: falta serverErrors.{codigo}  (lo manda {', '.join(sorted(de_pantalla[codigo]))})")

for fallo in fallos:
    print(f"FALLA  {fallo}")

if fallos:
    print(f"\n{len(fallos)} frases sin escribir. Quien se tope con esas verá el mensaje genérico del estado HTTP.")
    sys.exit(1)

print(f"errores ok — {len(de_pantalla)} códigos de pantalla con frase en {len(IDIOMAS)} idiomas, {solo_mcp} sólo de MCP")
