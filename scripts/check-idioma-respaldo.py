#!/usr/bin/env python3
"""Que todos los sitios que eligen idioma caigan en el mismo.

    python3 scripts/check-idioma-respaldo.py

Hay cuatro sitios en el servidor, y la aplicación, que deciden en qué idioma hablarle a alguien
—los documentos, los correos, el chat público y la pantalla del MCP— y cada
uno tiene su propia función porque cada uno mira cosas distintas. Lo que no
pueden tener distinto es **dónde caen cuando no saben**.

Caían en dos sitios: unos en castellano y otros en francés. El castellano
venía de que las claves están escritas en castellano, que es cómo se hizo el
producto y no algo que le importe a un contratista de Quebec. Ninguno de los
dos daba error: simplemente, según por qué puerta entrara la misma persona, se
le hablaba en un idioma o en otro.

Francés porque es el idioma del mercado y el que manda la ley allí.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
RESPALDO = "fr"

# Cada uno con el trozo de código donde se ve su respaldo.
SITIOS = [
    ("server/documents.ts", "normalizeDocLang"),
    ("server/correoTextos.ts", "normalizarLangCorreo"),
    ("server/flowMessages.ts", "FALLBACK_LANG"),
    ("server/mcpTextos.ts", "langDelMcp"),
    # La aplicación: el panel, el portal y la app del trabajador. Caía en
    # castellano mientras el servidor ya caía en francés.
    ("client/src/i18n/index.ts", "IDIOMA_DE_RESPALDO ="),
]

def cuerpoDesde(texto: str, inicio: int) -> str:
    """Desde el nombre hasta que se cierra su bloque, o la línea si no lo hay."""
    abre = texto.find("{", inicio)
    fin = texto.find("\n", inicio)
    if abre == -1 or (fin != -1 and abre > fin):
        return texto[inicio:fin if fin != -1 else len(texto)]
    profundidad = 0
    for i in range(abre, len(texto)):
        if texto[i] == "{":
            profundidad += 1
        elif texto[i] == "}":
            profundidad -= 1
            if profundidad == 0:
                return texto[inicio:i + 1]
    return texto[inicio:]


fallos = []
for ruta, nombre in SITIOS:
    fuente = RAIZ / ruta
    if not fuente.exists():
        fallos.append(f"{ruta} no existe — ¿se movió {nombre}?")
        continue
    texto = fuente.read_text(encoding="utf-8")
    inicio = texto.find(nombre)
    if inicio == -1:
        fallos.append(f"{ruta}: no encuentro {nombre}")
        continue

    # El cuerpo entero, contando llaves. Con una ventana de tamaño fijo se
    # cortaba justo antes del `return` final, que es donde vive el respaldo.
    cuerpo = cuerpoDesde(texto, inicio)
    # Comentarios fuera: explican el porqué y nombran idiomas.
    cuerpo = re.sub(r"//[^\n]*", "", cuerpo)
    cuerpo = re.sub(r"/\*.*?\*/", "", cuerpo, flags=re.S)

    # Las tres formas de escribir un respaldo: el `return` final, la rama
    # derecha de un ternario, y una constante suelta.
    devueltos = re.findall(r'(?:return|[:=])\s*"([a-z]{2})"\s*;', cuerpo)
    if not devueltos:
        fallos.append(f"{ruta}: no veo en qué idioma cae {nombre}")
    elif devueltos[-1] != RESPALDO:
        fallos.append(f'{ruta}: {nombre} cae en "{devueltos[-1]}" y no en "{RESPALDO}"')

for fallo in fallos:
    print(f"FALLA  {fallo}")

if fallos:
    print(f"\nSegún por qué puerta entre la misma persona, se le habla en un idioma o en otro.")
    sys.exit(1)

print(f'idioma ok — los {len(SITIOS)} sitios que eligen idioma caen en "{RESPALDO}"')
