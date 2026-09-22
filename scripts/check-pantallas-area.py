#!/usr/bin/env python3
"""Que ninguna pantalla del panel se quede sin área.

    python3 scripts/check-pantallas-area.py

`check-permisos.py` comprueba las familias de la **API**. Esto comprueba las
**pantallas**, que es la otra mitad y no la miraba nadie.

Una pantalla sin área no da error. Lo que hace es peor: `areaDeLaPantalla`
devuelve `null`, el menú no la esconde y `RequireBusinessAuth` no la cierra, así
que le sale a todo el mundo. La API sí está bien cerrada, o sea que un jefe de
obra ve la opción, la pulsa, y recibe un 403 en la cara.

Pasó con Conexiones MCP y con Automatizaciones: dos pantallas de Ajustes en el
menú de alguien que no puede abrirlas. Un botón que no puede funcionar es peor
que no tener botón, y aquí además parece que el sistema está roto.

Las excepciones son explícitas y están en `SIN_AREA`, con su razón escrita al
lado. Ahora mismo: la pantalla de suscripción, que es la salida del bloqueo y
ponerle área metería a un jefe de obra bloqueado en un bucle de redirecciones.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

# Las que no son del panel: públicas, de acceso, o utilidades sin dueño.
FUERA = ("/campo", "/portal", "/c/", "/negocio", "/cliente", "/404", "/iniciar-sesion",
         "/recuperar-password", "/privacy", "/terms")

app = (RAIZ / "client" / "src" / "App.tsx").read_text(encoding="utf-8")
rutas = [r for r in re.findall(r'<Route path=\{"([^"]+)"\}', app) if ":" not in r]

permisos = (RAIZ / "shared" / "permisos.ts").read_text(encoding="utf-8")
bloque = permisos[permisos.index("AREA_DE_PANTALLA"):permisos.index("export function areaDeLaPantalla")]
mapeadas = re.findall(r'"([^"]+)":\s*"(?:campo|clientes|dinero|personas|ajustes)"', bloque)

exentas = re.findall(r'"([^"]+)"', permisos[permisos.index("SIN_AREA"):permisos.index("SIN_AREA") + 260])


def area(ruta: str):
    """El prefijo más largo que encaje, igual que `areaDeLaPantalla`."""
    mejor, largo = None, -1
    for camino in mapeadas:
        encaja = ruta == "/" if camino == "/" else (ruta == camino or ruta.startswith(camino + "/"))
        if encaja and len(camino) > largo:
            mejor, largo = camino, len(camino)
    return mejor


huerfanas = [
    r for r in rutas
    if not r.startswith(FUERA) and r not in exentas and not area(r)
]

for ruta in huerfanas:
    print(f"FALLA  {ruta}: pantalla del panel sin área en AREA_DE_PANTALLA")

if huerfanas:
    print("\nLe saldrá en el menú a quien no pueda abrirla, y la API le contestará 403.")
    print("Ponle su área, o métela en SIN_AREA con la razón escrita.")
    sys.exit(1)

print(f"pantallas ok — {len(rutas)} rutas, todas las del panel con área, {len(exentas)} exentas a propósito")
