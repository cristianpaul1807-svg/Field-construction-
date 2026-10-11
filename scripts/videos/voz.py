"""Leer un texto en voz alta y guardarlo en MP3, con una voz neuronal.

    python3 -I scripts/videos/voz.py <voz> <archivo.mp3> <texto>

La usa `grabar.mjs` para la narración de cada vídeo. Las voces son las de
Microsoft (edge-tts): fr-CA-SylvieNeural para Quebec, it-IT-ElsaNeural para
Italia. La conexión sale por el proxy del entorno, cuyo certificado no está
en la lista de certifi que trae la librería: se le pasa el del sistema si
existe (SSL_CERT_FILE), en vez de desactivar la verificación.
"""
import asyncio
import os
import ssl
import sys

import edge_tts
from edge_tts import communicate

ca = os.environ.get("SSL_CERT_FILE")
if ca and os.path.exists(ca):
    communicate._SSL_CTX = ssl.create_default_context(cafile=ca)


async def main(voz: str, salida: str, texto: str) -> None:
    await edge_tts.Communicate(texto, voz, rate="+4%").save(salida)


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
