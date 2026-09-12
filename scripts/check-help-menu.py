#!/usr/bin/env python3
"""Las respuestas de ayuda no pueden nombrar el menú a mano.

Pasó una vez y no se vio hasta mirarlo a propósito: el bot estaba traducido a
los cuatro idiomas, y aun así en francés mandaba a «TERRAIN → Registre de
travail» cuando el menú dice CHANTIER → Suivi des travaux, y en italiano a
«CAMPO» cuando dice CANTIERE. Texto correcto, destino inexistente.

Un nombre de menú escrito a mano en una respuesta es una copia que nadie
actualiza. Por eso las respuestas interpolan {{menuX}} y el componente los
saca de `nav.*`: la ayuda nombra el menú como se llama, en cada idioma, sin
que nadie tenga que acordarse.

Este script falla si alguien vuelve a escribirlo a mano.
"""
import json
import re
import sys

LOCALES = ["es", "en", "fr", "it"]
BASE = "client/src/i18n/locales"

# Las etiquetas cortas dan falsos positivos por pura coincidencia del idioma
# ("CRM", "Portal", "Report"), así que sólo se vigilan las que identifican
# una sección sin ambigüedad.
MINIMO = 6

# Palabras que son del menú pero también del castellano corriente, y que en
# estas respuestas aparecen como lo segundo: "Subcontratistas" es además una
# categoría de línea de presupuesto, y "WhatsApp" sale nombrando la aplicación
# —"el mensaje de WhatsApp"—, no la pantalla de configurarla.
FUERA = {"whatsapp", "subcontractors"}

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
        todo = plano(datos)
        etiquetas = {
            v.strip(): k
            for k, v in plano(datos.get("nav", {})).items()
            if isinstance(v, str) and len(v.strip()) >= MINIMO and k not in FUERA
        }
        for clave, valor in todo.items():
            if not clave.startswith("help.") or not isinstance(valor, str):
                continue
            # Los títulos de las secciones del bot son su propio vocabulario:
            # que "Presupuestos" coincida con el menú no es una referencia.
            if clave.startswith("help.section."):
                continue
            # Sin los marcadores, o {{menuFichaje}} se delataría a sí mismo por
            # llevar "Fichaje" dentro.
            desnudo = MARCADOR.sub(" ", valor)
            for etiqueta, origen in etiquetas.items():
                if etiqueta in desnudo:
                    fallos.append(f"{lang}: {clave} escribe «{etiqueta}» a mano — usa {{{{menu…}}}} (nav.{origen})")

    if fallos:
        print("las respuestas de ayuda nombran el menú a mano:", file=sys.stderr)
        for f in fallos:
            print(f"  {f}", file=sys.stderr)
        print(
            "\nInterpola el nombre en vez de copiarlo: el componente pasa los\n"
            "valores de nav.* como {{menuAjustes}}, {{menuCampo}}, etc.",
            file=sys.stderr,
        )
        return 1

    print("help menu ok — ninguna respuesta nombra el menú a mano")
    return 0


if __name__ == "__main__":
    sys.exit(main())
