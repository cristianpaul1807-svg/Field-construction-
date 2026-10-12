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


def azure(voz: str, salida: str, texto: str) -> None:
    """La misma voz por el servicio oficial (Azure Speech), con licencia.

    edge-tts usa la puerta del navegador Edge, que no es para esto: en
    octubre de 2026 empezó a contestar 403 a todo y no hubo arreglo. Con
    AZURE_SPEECH_KEY y AZURE_SPEECH_REGION se va por la de pago, que tiene un
    nivel gratuito de sobra para un canal.
    """
    import urllib.request
    from xml.sax.saxutils import escape

    idioma = "-".join(voz.split("-")[:2])
    ssml = (
        f'<speak version="1.0" xml:lang="{idioma}"><voice name="{voz}">'
        f'<prosody rate="+4%">{escape(texto)}</prosody></voice></speak>'
    )
    peticion = urllib.request.Request(
        f"https://{os.environ['AZURE_SPEECH_REGION']}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": os.environ["AZURE_SPEECH_KEY"],
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
            "User-Agent": "logiciel-construction-videos",
        },
    )
    contexto = ssl.create_default_context(cafile=ca) if ca and os.path.exists(ca) else None
    with urllib.request.urlopen(peticion, context=contexto, timeout=60) as r, open(salida, "wb") as f:
        f.write(r.read())


async def main(voz: str, salida: str, texto: str) -> None:
    await edge_tts.Communicate(texto, voz, rate="+4%").save(salida)


def piper(salida: str, texto: str) -> None:
    """Una voz libre que corre aquí mismo, sin cuenta ni red (Piper).

    Para cuando no hay clave de Azure y edge-tts está cortado. Suena menos
    natural y no hay voz de Quebec: es el recurso, no la opción buena.
    PIPER_MODELO es la ruta al .onnx de la voz.
    """
    import subprocess
    import tempfile

    with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
        subprocess.run(
            [sys.executable, "-m", "piper", "-m", os.environ["PIPER_MODELO"], "-f", wav.name],
            input=texto.encode("utf-8"), check=True, capture_output=True,
        )
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav.name, "-b:a", "128k", salida], check=True)


if __name__ == "__main__":
    if os.environ.get("PIPER_MODELO"):
        piper(sys.argv[2], sys.argv[3])
    elif os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION"):
        azure(sys.argv[1], sys.argv[2], sys.argv[3])
    else:
        asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
