"""Forced-align known lyrics to a sung track → word timestamps.

    python scripts/align.py public/<slug>/song.mp3 content/<slug>.lyrics.txt out.json

Uses stable-ts (Whisper) alignment: the text is already known, so it only has to find
*when* each word is sung — far more reliable than free transcription on music.
Install once:  pip install -U stable-ts   (and ffmpeg on PATH)
Tip: for cleaner timing, align on the isolated vocal stem (Suno lets you download stems).
"""
import json
import os
import re
import sys

# macOS + conda: PyTorch and conda each ship libomp; without this Python aborts with
# "OMP: Error #15 ... libomp.dylib already initialized". Standard workaround, safe for inference.
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import stable_whisper

audio, lyrics_path, out_path = sys.argv[1:4]
lines = [l.strip() for l in open(lyrics_path, encoding="utf8") if l.strip() and not l.strip().startswith("[")]
model = stable_whisper.load_model(os.environ.get("WHISPER_MODEL", "small"))
result = model.align(audio, "\n".join(lines), language="en")

words = [w for seg in result.segments for w in seg.words if w.word.strip()]
out, k = [], 0
for line in lines:
    n = len(line.split())
    chunk = words[k : k + n]
    k += n
    out.append(
        {
            "text": line,
            "words": [{"w": re.sub(r"\s+", "", w.word), "start": round(w.start, 3), "end": round(w.end, 3)} for w in chunk],
        }
    )
# --- sanity pass on the vocals: Whisper sometimes parks the last word of a section inside the
# following instrumental break. A word may not START in a long silence; pull it back to just
# before the silence begins (after the previous word).
def _silences(path):
    import subprocess

    import numpy as np

    sr, hop = 16000, 160
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    n = len(x) // hop
    db = 20 * np.log10(np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)
    db = np.convolve(db, np.ones(5) / 5, "same")
    voiced = db > np.percentile(db, 95) - 24
    gaps, i = [], 0
    while i < n:
        if not voiced[i]:
            j = i
            while j < n and not voiced[j]:
                j += 1
            if j - i >= 60:  # ≥ 0.6 s of silence
                gaps.append((i / 100, j / 100))
            i = j
        else:
            i += 1
    return gaps

fixed = 0
try:
    gaps = _silences(audio)
    prev = None
    for line in out:
        ws = line["words"]
        for idx, w in enumerate(ws):
            for g0, g1 in gaps:
                if not (g0 + 0.05 < w["start"] < g1 - 0.05):
                    continue
                first, lastw = idx == 0, idx == len(ws) - 1
                if first or (not lastw and g1 - w["start"] < w["start"] - g0):
                    new = g1  # the singer (re)starts when the silence ends
                else:
                    new = max((prev or 0) + 0.12, g0 - 0.35)  # word belongs before the silence
                if abs(new - w["start"]) > 0.02:
                    w["start"] = round(new, 3)
                    w["end"] = round(max(w["end"], new + 0.1), 3)
                    fixed += 1
                break
            prev = w["start"]
    # a line never spans an instrumental break (≥ 1.5 s): words of a line that Whisper put after
    # the break belong before it
    long_gaps = [(g0, g1) for g0, g1 in gaps if g1 - g0 >= 1.5]
    for line in out:
        ws = line["words"]
        for i in range(1, len(ws)):
            hit = [(g0, g1) for g0, g1 in long_gaps if ws[i - 1]["start"] < g0 and g1 <= ws[i]["start"] + 0.05]
            if not hit:
                continue
            g0 = hit[0][0]
            lo, hi = ws[i - 1]["start"] + 0.15, g0 - 0.05
            n = len(ws) - i
            step = max(0.08, (hi - lo) / n) if hi > lo else 0.08
            for q in range(n):
                ws[i + q]["start"] = round(lo + q * step, 3)
                ws[i + q]["end"] = round(min(g0, lo + (q + 1) * step), 3)
                fixed += 1
            break
    # the first word after a long break starts when the singing resumes
    for line in out:
        w = line["words"][0] if line["words"] else None
        if not w:
            continue
        for g0, g1 in long_gaps:
            if g1 - 0.05 <= w["start"] <= g1 + 0.6 and abs(w["start"] - g1) > 0.02:
                w["start"] = round(g1, 3)
                fixed += 1
                break
    # keep words in order with a minimum spacing
    for line in out:
        ws = line["words"]
        for i in range(1, len(ws)):
            if ws[i]["start"] < ws[i - 1]["start"] + 0.08:
                ws[i]["start"] = round(ws[i - 1]["start"] + 0.08, 3)
except Exception as e:  # never fail the alignment because of the sanity pass
    print(f"(silence check skipped: {e})")

json.dump({"duration": result.segments[-1].end if result.segments else 0, "lines": out}, open(out_path, "w"), indent=1)
if fixed:
    print(f"moved {fixed} word(s) out of silent gaps")
print(f"aligned {len(words)} words over {len(lines)} lines → {out_path}")
