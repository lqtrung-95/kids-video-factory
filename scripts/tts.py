"""Free text-to-speech backends for step 3.

    python scripts/tts.py edge   "en-US-AnaNeural" "Hello!" out.mp3
    python scripts/tts.py kokoro "af_heart"        "Hello!" out.mp3

edge   : Microsoft Edge "Read aloud" voices via the edge-tts package. Free, no key, sounds great,
         needs internet. Unofficial API — fine for testing; check terms before monetizing.
         pip install edge-tts
kokoro : Kokoro-82M, open-source (Apache-2.0, commercial use OK), runs offline on CPU.
         First run downloads the model (~330 MB) from Hugging Face.
         pip install kokoro soundfile   (+ espeak-ng from your package manager)
"""
import subprocess
import sys

provider, voice, text, out = sys.argv[1:5]

if provider == "edge":
    import asyncio

    import edge_tts

    # slightly slower + brighter suits preschool narration
    asyncio.run(edge_tts.Communicate(text, voice, rate="-8%", pitch="+4Hz").save(out))

elif provider == "kokoro":
    import numpy as np
    import soundfile as sf
    from kokoro import KPipeline

    pipe = KPipeline(lang_code=voice[0])  # 'a' = American English voices (af_*, am_*), 'b' = British
    audio = np.concatenate([a for _, _, a in pipe(text, voice=voice, speed=0.92)])
    wav = out.rsplit(".", 1)[0] + ".wav"
    sf.write(wav, audio, 24000)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-b:a", "160k", out], check=True)

else:
    raise SystemExit(f"unknown provider {provider}")
