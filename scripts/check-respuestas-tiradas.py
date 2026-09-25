#!/usr/bin/env python3
"""Que ninguna llamada al servidor tire su respuesta.

    python3 scripts/check-respuestas-tiradas.py

`apiFetch` no lanza cuando el servidor contesta 400 o 500: devuelve la
respuesta y sigue. Está bien para quien la mira. El problema es quien no:

    await apiFetch(`/api/estimates/${id}/lines`, { method: "POST", … });
    setLineForm(vacio);
    refresh();

Si el servidor rechaza la línea, el formulario se limpia y la lista se recarga
igual — un rechazo idéntico a un éxito, sólo que lo que iba a guardarse no está.
Había 32 así. Entre ellos, mandar un mensaje a un cliente y guardar la nómina:
el mensaje que uno cree enviado y el sueldo que uno cree apuntado. Y una
descarga del informe de la CCQ que, si fallaba, bajaba el JSON del error con
nombre de CSV.

Para mandar algo sin querer mirar la respuesta está `apiEnviar`, que cuenta el
fallo y corta lo que viene detrás. Para bajar un fichero, `downloadFile`.
`apiFetch` se queda para quien sí mira `res.ok`.
"""

import pathlib
import re
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FUENTES = sorted((RAIZ / "client" / "src").rglob("*.tsx")) + sorted((RAIZ / "client" / "src").rglob("*.ts"))

# `await apiFetch(…)` como sentencia suelta: el resultado no va a ninguna parte.
SUELTA = re.compile(r"^[ \t]*await apiFetch\(", re.M)

# `const res = await apiFetch(…)` seguido de `res.blob()` sin mirar antes si
# vino bien: es el caso de la CCQ, un fallo que se descarga como fichero.
BLOB_SIN_MIRAR = re.compile(r"const (\w+) = await apiFetch\([^;]*\);\s*\n\s*const \w+ = await \1\.blob\(\)")

fallos = []
for f in FUENTES:
    s = f.read_text(encoding="utf-8")
    rel = f.relative_to(RAIZ)
    for m in SUELTA.finditer(s):
        fallos.append(f"{rel}:{s[:m.start()].count(chr(10)) + 1}  `await apiFetch(…)` sin guardar la respuesta — usa `apiEnviar`")
    for m in BLOB_SIN_MIRAR.finditer(s):
        fallos.append(f"{rel}:{s[:m.start()].count(chr(10)) + 1}  se descarga `.blob()` sin mirar `res.ok` — usa `downloadFile`")

for fallo in fallos:
    print(f"FALLA  {fallo}")

if fallos:
    print(f"\n{len(fallos)} llamadas en las que un rechazo del servidor se ve igual que un éxito.")
    sys.exit(1)

print(f"respuestas ok — ninguna llamada al servidor tira su respuesta ({len(FUENTES)} ficheros)")
