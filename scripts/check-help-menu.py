#!/usr/bin/env python3
"""Un texto que manda a una pantalla no puede escribir su nombre a mano.

Se vigilan los textos con flecha —"ve a X → Y"—, que son los que dan
indicaciones. El nombre que va detrás de la flecha tiene que salir de `nav.*`
interpolado, no copiado.

Copiarlo parece inofensivo y no lo es: son cuatro copias, una por idioma, que
nadie vuelve a comparar con el menú. Ya había divergido en varios sitios a la
vez sin que nada fallara:

  · el bot de ayuda mandaba en francés a "TERRAIN → Registre de travail"
    cuando el menú dice CHANTIER → Suivi des travaux
  · el aviso del GPS decía "Company details" cuando la entrada es Company Data
  · las nóminas mandaban en castellano a "Check-in" cuando se llama Fichaje

Un texto correcto que manda a una opción inexistente es peor que no tener
ayuda, porque hace dudar de sí misma a la persona que lo lee.

El título de una pantalla sí puede coincidir con su entrada de menú —de hecho
debe—, así que sólo se mira lo que va detrás de una flecha.
"""
import json
import re
import sys

LOCALES = ["es", "en", "fr", "it"]
BASE = "client/src/i18n/locales"

# Textos con flecha que no mandan a ninguna pantalla nuestra:
# `budgets.description` describe la jerarquía de un presupuesto (Zona →
# Categoría → Ítem) y `settings.pasteInWhatsapp` recita el menú de la propia
# aplicación de WhatsApp, que no debe seguir al nuestro si lo renombramos.
# También la secuencia de botones dentro de una pantalla: `crear.p2` encadena
# "Nuevo presupuesto → eliges el cliente → Crear presupuesto", que son tres
# pulsaciones seguidas ahí dentro y no un camino por el menú.
PROSA = {"budgets.description", "settings.pasteInWhatsapp", "help.topic.presupuestos.crear.p2"}

MARCADOR = re.compile(r"\{\{[^}]*\}\}")


def plano(d, prefijo=""):
    salida = {}
    for clave, valor in d.items():
        if isinstance(valor, dict):
            salida.update(plano(valor, prefijo + clave + "."))
        else:
            salida[prefijo + clave] = valor
    return salida


def main():
    fallos = []
    for lang in LOCALES:
        datos = json.load(open(f"{BASE}/{lang}.json"))

        for clave, valor in plano(datos).items():
            if clave in PROSA or clave.startswith("nav."):
                continue
            if not isinstance(valor, str) or "→" not in valor:
                continue

            # Lo que abre el camino tiene que ser un marcador.
            #
            # No se comprueba si el nombre escrito es el correcto, porque eso
            # sólo detectaría los que ya están bien: un nombre equivocado no
            # coincide con ninguna etiqueta y pasaría de largo — que es
            # exactamente como se coló la avería. Se comprueba lo contrario:
            # que no haya nombre escrito, venga o no del menú de verdad.
            camino = valor[: valor.index("→")]
            if "{{" not in camino:
                fallos.append(f"{lang}: {clave} — «…{camino.strip()[-40:]} →» sin interpolar")

    if fallos:
        print("textos que nombran una pantalla a mano:", file=sys.stderr)
        for f in fallos:
            print(f"  {f}", file=sys.stderr)
        print(
            "\nInterpólalo en vez de copiarlo: useNombresDelMenu() da\n"
            "{{menuAjustes}}, {{menuCampo}}, {{menuRegistro}}… desde nav.*.",
            file=sys.stderr,
        )
        return 1

    print("menu ok — ningún texto nombra una pantalla a mano")
    return 0


if __name__ == "__main__":
    sys.exit(main())
