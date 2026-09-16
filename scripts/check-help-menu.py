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
NOMBRES = "client/src/lib/nombresDelMenu.ts"

# `menuAjustes: t("nav.settings"),` y `{{menuAjustes}}`.
DEFINIDO = re.compile(r"^\s*(menu[A-ZÁÉÍÓÚ][A-Za-z]*)\s*:", re.M)
USADO = re.compile(r"\{\{(menu[A-Za-z]+)\}\}")

# Textos con flecha que no mandan a ninguna pantalla nuestra:
# `budgets.description` describe la jerarquía de un presupuesto (Zona →
# Categoría → Ítem) y `settings.pasteInWhatsapp` recita el menú de la propia
# aplicación de WhatsApp, que no debe seguir al nuestro si lo renombramos.
# También la secuencia de botones dentro de una pantalla: `crear.p2` encadena
# "Nuevo presupuesto → eliges el cliente → Crear presupuesto", que son tres
# pulsaciones seguidas ahí dentro y no un camino por el menú.
# Textos donde la flecha no lleva a una pantalla nuestra.
#
# Los tres primeros son prosa: una flecha dentro de una frase, no un camino.
# `quickbooks.fix.tax` es distinto: nombra un camino de verdad, pero del menú
# de **QuickBooks**, que no sale de nuestro `nav.*` y que no podemos
# interpolar. La guarda existe para que nuestros nombres no se copien a mano y
# deriven del menú; el menú de otro no puede derivar de nada nuestro.
PROSA = {
    "budgets.description",
    "settings.pasteInWhatsapp",
    "help.topic.presupuestos.crear.p2",
    "quickbooks.fix.tax",
    # Igual que el anterior: estos dos recitan el menú de QuickBooks —Impuestos
    # → Impuesto sobre las ventas, y engranaje → Cuenta y configuración— para
    # decirle a la persona dónde crear el código de impuesto de su provincia.
    # Son pantallas de Intuit; si Intuit las renombra, lo arreglamos a mano.
    "help.topic.dinero.impuestoQuickBooks.p2",
    "help.topic.dinero.impuestoQuickBooks.p3",
}



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
    usados = set()
    for lang in LOCALES:
        datos = json.load(open(f"{BASE}/{lang}.json"))

        for clave, valor in plano(datos).items():
            if not isinstance(valor, str):
                continue
            usados.update(USADO.findall(valor))
            if clave in PROSA or clave.startswith("nav."):
                continue
            if "→" not in valor:
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

    # La otra mitad del mismo problema.
    #
    # Interpolar está bien, pero un marcador que no existe se imprime tal cual:
    # el contratista lee «{{menuNominas}}» en mitad de una frase y nadie se
    # entera, porque no falla nada. Pasó al añadir el tema de las tasas en
    # cero, y la comprobación de arriba lo dejó pasar — decía la verdad: no
    # había ningún nombre escrito a mano.
    disponibles = set(DEFINIDO.findall(open(NOMBRES, encoding="utf-8").read()))
    inventados = sorted(usados - disponibles)
    if inventados:
        print("marcadores de menú que no existen:", file=sys.stderr)
        for m in inventados:
            print(f"  {{{{{m}}}}}", file=sys.stderr)
        print(
            f"\nAñádelos a {NOMBRES} apuntando a su clave de nav.*, o usa uno\n"
            f"de los que ya hay: {', '.join(sorted(disponibles))}.",
            file=sys.stderr,
        )
        return 1

    print(f"menu ok — ningún texto nombra una pantalla a mano, {len(usados)} marcadores existen")
    return 0


if __name__ == "__main__":
    sys.exit(main())
