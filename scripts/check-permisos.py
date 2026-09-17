#!/usr/bin/env python3
"""Toda ruta del panel tiene que pertenecer a un área.

El bloqueo por permisos se hace en un solo sitio, comparando el prefijo de la
ruta contra `shared/permisos.ts`. Eso lo hace difícil de olvidar, pero no
imposible: la familia de rutas que alguien añada mañana y no meta en el mapa
se queda sin área.

El servidor está escrito para que ese caso **niegue** en vez de dejar pasar,
así que el fallo se ve en cuanto alguien con rol abre esa pantalla. Esto lo
adelanta a antes de desplegarlo, que es bastante mejor que enterarse por el
jefe de obra de un cliente.

Sólo se miran las rutas de debajo de `apiRouter.use(requireBusinessAuth)`. Las
de arriba son públicas, del trabajador o del cliente, y no pasan por aquí.
"""
import re
import sys

API = "server/api.ts"
PERMISOS = "shared/permisos.ts"

RUTA = re.compile(r'apiRouter\.(?:get|post|patch|put|delete)\(\s*\n?\s*"([^"]+)"')


def familias_del_panel() -> set[str]:
    with open(API, encoding="utf-8") as f:
        codigo = f.read()
    corte = codigo.index("apiRouter.use(requireBusinessAuth)")
    return {
        m.group(1).strip("/").split("/")[0]
        for m in RUTA.finditer(codigo)
        if m.start() > corte
    }


def familias_del_mapa() -> set[str]:
    with open(PERMISOS, encoding="utf-8") as f:
        codigo = f.read()
    cuerpo = codigo[codigo.index("export const AREA_DE"): codigo.index("export const DE_TODOS")]
    # Las claves van con comillas cuando llevan guion y sin ellas cuando no.
    return set(re.findall(r'^\s*"?([a-z0-9-]+)"?\s*:\s*"[a-z]+"', cuerpo, re.M))


def familias_de_todos() -> set[str]:
    """Las que no son de ningún área porque las usa cualquier papel.

    Se leen del mismo archivo en vez de repetirlas aquí. Una lista de
    excepciones escrita en el guardia se desincroniza del código que vigila, y
    entonces el guardia protege de mentira: o avisa de algo que ya está bien,
    o —peor— deja de avisar de una puerta que alguien abrió sin pensarlo.
    """
    with open(PERMISOS, encoding="utf-8") as f:
        codigo = f.read()
    linea = re.search(r"export const DE_TODOS[^=]*=\s*\[([^\]]*)\]", codigo, re.S)
    return set(re.findall(r'"([a-z0-9-]+)"', linea.group(1))) if linea else set()


def main() -> int:
    panel = familias_del_panel()
    mapa = familias_del_mapa()
    de_todos = familias_de_todos()

    sin_area = sorted(panel - mapa - de_todos)
    de_sobra = sorted(mapa - panel)
    # Una excepción que ya no corresponde a ninguna ruta es una puerta abierta
    # a nada, y la siguiente ruta que se llame así la hereda sin querer.
    huerfanas = sorted(de_todos - panel)
    if huerfanas:
        print("aviso — en DE_TODOS y ya no en la API: " + ", ".join(huerfanas))

    if sin_area:
        print("Estas familias de rutas del panel no tienen área en shared/permisos.ts:")
        for f in sin_area:
            print(f"  · {f}")
        print("\nDecide a qué área pertenece cada una y añádela a AREA_DE.")
        return 1

    if de_sobra:
        # No es un fallo: una familia puede desaparecer y el mapa sobrevivirle.
        # Pero un mapa lleno de nombres muertos deja de leerse.
        print("aviso — en el mapa y ya no en la API: " + ", ".join(de_sobra))

    print(f"permisos ok — {len(panel)} familias del panel: {len(panel - de_todos)} con área, "
          f"{len(panel & de_todos)} de todos ({', '.join(sorted(panel & de_todos))})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
