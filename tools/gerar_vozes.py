"""Gera os áudios das falas do Faladeiro com voz neural pt-BR.

Uso:
    python -m pip install edge-tts
    python tools/gerar_vozes.py            # gera só o que falta
    python tools/gerar_vozes.py --todas    # regrava tudo (ex.: depois de trocar voz/tom)

Para mudar ou acrescentar falas, edite voice/falas.json e rode de novo.
"""
import asyncio
import json
import pathlib
import sys

import edge_tts

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PASTA = RAIZ / "voice"
TODAS = "--todas" in sys.argv


def ler_catalogo():
    return json.loads((PASTA / "falas.json").read_text(encoding="utf-8"))


async def gerar(fid, spec, cat, sem, feitos):
    saida = PASTA / f"{fid}.mp3"
    if saida.exists() and saida.stat().st_size > 0 and not TODAS:
        return
    texto = spec if isinstance(spec, str) else spec["text"]
    rate = cat["rate"] if isinstance(spec, str) else spec.get("rate", cat["rate"])
    pitch = cat["pitch"] if isinstance(spec, str) else spec.get("pitch", cat["pitch"])
    async with sem:
        for tentativa in range(5):
            try:
                com = edge_tts.Communicate(texto, cat["voice"], rate=rate, pitch=pitch)
                await com.save(str(saida))
                feitos.append(fid)
                print(f"ok  {fid:<22} {texto}")
                return
            except Exception as e:  # rede instável: tenta de novo
                print(f"..  {fid} tentativa {tentativa + 1}: {e}")
                await asyncio.sleep(1.5 * (tentativa + 1))
        print(f"ERRO {fid}")


async def main():
    cat = ler_catalogo()
    sem = asyncio.Semaphore(4)
    feitos = []
    await asyncio.gather(*(gerar(fid, spec, cat, sem, feitos) for fid, spec in cat["lines"].items()))
    faltando = [fid for fid in cat["lines"] if not (PASTA / f"{fid}.mp3").exists()]
    print(f"\nGerados agora: {len(feitos)}  |  Total no catálogo: {len(cat['lines'])}  |  Faltando: {len(faltando)}")
    if faltando:
        print("Faltando:", ", ".join(faltando))


if __name__ == "__main__":
    asyncio.run(main())
