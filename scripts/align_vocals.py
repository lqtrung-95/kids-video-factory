"""Model-free lyric timing from an isolated VOCALS stem (Demucs / Suno stems).

    python scripts/align_vocals.py vocals.wav lyrics.txt out.json

No Whisper, no downloads, needs only numpy + ffmpeg. How it works:
  1. measure loudness of the vocal track every 10 ms → where the singer is singing
  2. build a "sung time" axis that skips the pauses
  3. spread the syllables of the lyrics along that sung axis
  4. snap each line start onto the nearest breath/pause (singers breathe between lines)
Line timing is usually within ~0.2 s; word timing inside a line is approximate.
stable-ts (scripts/align.py) is still more precise per word when it is available.
"""
import json
import re
import subprocess
import sys

import numpy as np

vocals, lyrics_path, out_path = sys.argv[1:4]
SR, HOP = 16000, 160  # 10 ms frames

pcm = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", vocals, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
    check=True, capture_output=True,
).stdout
x = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
n = len(x) // HOP
db = 20 * np.log10(np.sqrt((x[: n * HOP].reshape(n, HOP) ** 2).mean(1)) + 1e-9)
db = np.convolve(db, np.ones(5) / 5, "same")  # 50 ms smoothing

# spectral flux = "something new started" (a syllable onset), even when loudness doesn't dip
WIN = 1024
frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (WIN // 2, WIN // 2)), WIN)[::HOP][:n]
mag = np.abs(np.fft.rfft(frames * np.hanning(WIN), axis=1))[:, 6:256]  # ~100 Hz – 4 kHz
logmag = np.log1p(mag * 100)
flux = np.concatenate([[0], np.maximum(0, np.diff(logmag, axis=0)).sum(1)])
flux = np.convolve(flux, np.hanning(7) / np.hanning(7).sum(), "same")

loud = np.percentile(db, 95)
voiced = db > loud - 24  # within 24 dB of the loud parts = singing
# close tiny holes (consonants), drop tiny blips (breath noise)
def runs(mask):
    out, i = [], 0
    while i < len(mask):
        j = i
        while j < len(mask) and mask[j] == mask[i]:
            j += 1
        out.append((mask[i], i, j))
        i = j
    return out
for val, a, b in runs(voiced):
    if not val and b - a < 8:
        voiced[a:b] = True
for val, a, b in runs(voiced):
    if val and b - a < 6:
        voiced[a:b] = False

idx = np.flatnonzero(voiced)
if not len(idx):
    raise SystemExit("no singing found in the vocals stem")
first, last = idx[0], idx[-1]
# --- rhythm ---------------------------------------------------------------------------------
# 1) the song's basic pulse ("base", frames) from the autocorrelation of onsets. The instrumental
#    stem (drums, claps, ukulele strums) gives a much cleaner pulse than the voice, so use it if given.
def _flux_of(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         check=True, capture_output=True).stdout
    y = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    m = len(y) // HOP
    fr = np.lib.stride_tricks.sliding_window_view(np.pad(y, (WIN // 2, WIN // 2)), WIN)[::HOP][:m]
    lm = np.log1p(np.abs(np.fft.rfft(fr * np.hanning(WIN), axis=1))[:, 2:256] * 100)
    return np.concatenate([[0], np.maximum(0, np.diff(lm, axis=0)).sum(1)])

instrumental = sys.argv[4] if len(sys.argv) > 4 else None
_src = _flux_of(instrumental)[first:last] if instrumental else flux[first:last]
_f = _src - _src.mean()
_ac = np.correlate(_f, _f, "full")[len(_f) - 1:]
_peaks = [l for l in range(15, min(130, len(_ac) - 1)) if _ac[l] > _ac[l - 1] and _ac[l] >= _ac[l + 1]]
if _peaks:
    _best = max(_ac[l] for l in _peaks)
    _L = min(l for l in _peaks if _ac[l] >= 0.8 * _best)  # fundamental, not a multiple
    y0, y1, y2 = _ac[_L - 1], _ac[_L], _ac[_L + 1]
    den = y0 - 2 * y1 + y2
    base = _L + (float(np.clip(0.5 * (y0 - y2) / den, -0.5, 0.5)) if den < 0 else 0.0)
    rhythmic = _ac[_L] / (_ac[0] + 1e-9) > 0.12
else:
    _L, base, rhythmic = 27, 27.0, False

pauses = [(a, b) for val, a, b in runs(voiced) if not val and a > first and b <= last and b - a >= 8]

lines = [l.strip() for l in open(lyrics_path, encoding="utf8") if l.strip() and not l.strip().startswith("[")]
def syllables(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    s = len(re.findall(r"[aeiouy]+", w))
    # silent final e (whole, noise) — but "lit-tle", "pad-dle", "free" keep theirs
    if s > 1 and w.endswith("e") and not w.endswith("ee") and not re.search(r"[^aeiouy]le$", w):
        s -= 1
    # silent -es / -ed (makes, wakes, goes, jumped) — but "hor-ses", "want-ed" keep theirs
    elif s > 1 and w.endswith(("es", "ed")) and not re.search(r"(s|z|ch|sh|x|ge|ce)es$|[td]ed$", w):
        s -= 1
    return max(1, s)
words = [[(w, syllables(w)) for w in l.split()] for l in lines]
total_syl = sum(s for line in words for _, s in line)

# 2) how long one sung syllable lasts: half a pulse, one pulse, or two? Pick the multiple of the
#    pulse closest to the measured singing time per syllable (fast songs ≈ eighth notes,
#    slower songs ≈ quarter notes).
_per_syl = voiced.sum() / max(1, total_syl)
P = min((base * m for m in (0.5, 1, 2, 4)), key=lambda u: abs(np.log(u / _per_syl)))

# sung-time axis: cumulative voiced frames
cum = np.cumsum(voiced)
sung_total = cum[last]
def frame_at(sung):  # first frame where cumulative voiced >= sung
    return int(np.searchsorted(cum, max(1, sung)))

def onsets_in(a, b):
    """local maxima of spectral flux in [a, b) (frames), strongest first-class candidates"""
    seg = flux[a:b]
    if len(seg) < 3:
        return []
    thr = np.median(seg) + 0.5 * seg.std()
    peaks = [i for i in range(2, len(seg) - 2) if seg[i] >= seg[i - 2:i + 3].max() and seg[i] > thr and voiced[a + i]]
    return [(a + i, float(seg[i] / (seg.max() + 1e-9))) for i in peaks]

# initial line starts proportional to syllables, then snap to nearest pause end (±0.7 s)
line_syl = [sum(s for _, s in l) for l in words]
starts, anchored, acc = [], [], 0
for k, ls in enumerate(line_syl):
    f = frame_at(acc / total_syl * sung_total)
    snapped = k == 0
    if k > 0 and pauses:
        best = min(pauses, key=lambda p: abs(p[1] - f))
        if abs(best[1] - f) <= 70:
            f, snapped = best[1], True
    starts.append(max(f, starts[-1] + 30 if starts else f))
    anchored.append(snapped)
    acc += ls
starts[0] = first

# Lines sung legato (no breath) have no pause to snap to. If the anchored lines show a steady
# line length (e.g. one bar per line), predict the next start from it and snap to the strongest
# nearby onset.
gaps = [starts[k] - starts[k - 1] for k in range(1, len(starts)) if anchored[k] and anchored[k - 1]]
if len(gaps) >= 3:
    period = float(np.median(gaps))
    if np.mean([abs(g - period) <= 0.12 * period for g in gaps]) >= 0.6:
        win = max(10, int(P * 0.5))
        for k in range(1, len(starts)):
            if anchored[k]:
                continue
            pred = int(starts[k - 1] + period)
            near = onsets_in(max(0, pred - win), pred + win + 1)
            f = max(near, key=lambda c: c[1] - abs(c[0] - pred) / (win * 2))[0] if near else pred
            starts[k] = max(f, starts[k - 1] + 30)
# --- Structure-aware line starts -------------------------------------------------------------
# Kids' songs are built from bars: usually one lyric line per bar, verses separated by
# instrumental breaks. Split the singing into sections at long breaks, give each section the
# number of lines that fits its length in bars, lay the lines on the bar grid, then snap each
# start to the nearest real onset. This is far more robust than proportional guessing when
# Suno adds an instrumental break or a singer pauses inside a line.
structure = None
if rhythmic and len(lines) > 1:
    bar = 8 * P  # a line usually spans 8 syllable slots (one bar of eighths, or two bars of quarters)
    min_gap = int(5 * P)  # a break longer than ~2.5 beats separates sections (breaths are shorter)
    secs, a0, prev = [], None, None
    for val, s0, s1 in runs(voiced):
        if not val:
            continue
        if a0 is None:
            a0 = s0
        elif s0 - prev >= min_gap:
            secs.append((a0, prev))
            a0 = s0
        prev = s1
    if a0 is not None:
        secs.append((a0, prev))
    N = len(lines)
    best = None
    for k in (1, 2, 0.5, 1.5, 0.75):  # lines of 8, 16, 4, 12 or 6 slots
        raw = [(b - a) / (bar * k) for a, b in secs]
        miss = abs(sum(raw) - N) / N
        if best is None or miss < best[0]:
            best = (miss, k, raw)
    miss, k, raw = best
    if miss <= 0.2:
        # largest-remainder rounding so the counts add up to exactly N
        counts = [int(r) for r in raw]
        for idx in sorted(range(len(raw)), key=lambda q: raw[q] - int(raw[q]), reverse=True)[: N - sum(counts)]:
            counts[idx] += 1
        while sum(counts) > N:
            idx = max(range(len(counts)), key=lambda q: counts[q] - raw[q])
            counts[idx] -= 1
        new_starts = []
        for (a, b), n in zip(secs, counts):
            if n <= 0:
                continue
            spacing = bar * k
            if abs((b - a) / n - spacing) > 0.3 * spacing:
                spacing = (b - a) / n
            for j in range(n):
                if j == 0:
                    f = a
                else:
                    # predict from the previous line (+1 line length) so small errors don't accumulate
                    f = int(round(new_starts[-1] + spacing))
                    # never so late that the remaining lines can't fit before the section ends
                    f = min(f, int(b - (n - j) * spacing * 0.6))
                    pwin = int(min(0.35 * spacing, 2 * P))
                    pe = [(pa, pb) for pa, pb in pauses if abs(pb - f) <= pwin and pb > new_starts[-1] + 0.5 * spacing]
                    if pe:  # the end of a breath = the singer starts the line; breaths between
                        # lines are longer than quick breaths inside a line, so length counts too
                        f = min(pe, key=lambda p: abs(p[1] - f) - 0.6 * (p[1] - p[0]))[1]
                    else:
                        win = int(P * 0.9)
                        near = onsets_in(max(a, f - win), min(b, f + win + 1))
                        if near:
                            f = max(near, key=lambda c: c[1] - abs(c[0] - f) / (win * 2))[0]
                new_starts.append(f)
        if len(new_starts) == N and all(y > x + 20 for x, y in zip(new_starts, new_starts[1:])):
            starts = new_starts
            # a line never runs across an instrumental break
            sec_end = {}
            for (a, b), n in zip(secs, counts):
                sec_end[a] = b
            structure = f"{len(secs)} section(s) → {' + '.join(str(c) for c in counts)} lines, {k:g} bar(s) per line"

ends = []
for kk in range(len(starts)):
    nxt = starts[kk + 1] if kk + 1 < len(starts) else last + 1
    # if an instrumental break sits between this line and the next, end the line at the break
    gap = [pa for pa, pb in [(pa, pb) for val, pa, pb in runs(voiced) if not val] if starts[kk] < pa < nxt and pb - pa >= int(5 * P)]
    ends.append(gap[0] if gap else nxt)

def place_words(line, a, b):
    """Word starts: first word at line start; the others snap to syllable onsets near their
    syllable-proportional position (dynamic programming keeps them in order)."""
    syl = [s for _, s in line]
    tot = sum(syl)
    seg_cum = np.cumsum(voiced[a:b])
    seg_total = max(1, int(seg_cum[-1]) if len(seg_cum) else 1)
    expected, acc = [], 0
    slots = int((b - a) / P) + 1
    use_grid = rhythmic and tot <= slots and tot * P >= 0.45 * (b - a)
    for s in syl:
        if use_grid:  # syllable k sits on eighth-note k; the last one is held to the end of the line
            expected.append(a + int(round(acc * P)))
        else:  # fallback: spread syllables over the sung time
            expected.append(a + int(np.searchsorted(seg_cum, max(1, acc / tot * seg_total))))
        acc += s
    W = len(line)
    cands = onsets_in(a + 8, b)  # skip the line's own onset
    if W == 1 or not cands:
        return expected
    SIG = max(8.0, P * 0.4)  # tolerance around the expected position (frames)
    INF = 1e9
    C = len(cands)
    # dp[i][j]: best cost placing word i (1..W-1) at candidate j; words may also stay at "expected" (-1)
    best = [dict() for _ in range(W)]
    best[0] = {-1: (0.0, None, a)}
    for i in range(1, W):
        for j in list(range(C)) + [-1]:
            pos = cands[j][0] if j >= 0 else expected[i]
            cost_here = ((pos - expected[i]) / SIG) ** 2 - (1.2 * cands[j][1] if j >= 0 else -0.6)
            bestc = (INF, None, pos)
            for pj, (pc, _, ppos) in best[i - 1].items():
                if ppos + 7 > pos:  # keep order, min 70 ms per word
                    continue
                if j >= 0 and pj == j:
                    continue
                c = pc + cost_here
                if c < bestc[0]:
                    bestc = (c, pj, pos)
            if bestc[0] < INF:
                best[i][j] = bestc
    if not best[W - 1]:
        return expected
    j = min(best[W - 1], key=lambda k: best[W - 1][k][0])
    starts = [0] * W
    for i in range(W - 1, -1, -1):
        c, pj, pos = best[i][j]
        starts[i] = pos
        j = pj
    starts[0] = a
    return starts

out = []
for k, line in enumerate(words):
    a, b = starts[k], ends[k]
    while b - 1 > a and not voiced[b - 1]:  # trim the trailing pause of this line
        b -= 1
    ws_start = place_words(line, a, b)
    # breaths inside the line: a word after a comma starts when the breath ends, and no word
    # may start in silence
    inner = [(pa, pb) for pa, pb in pauses if a < pa and pb < b]
    for pa, pb in inner:
        # each breath belongs to ONE word: the closest word that follows punctuation, or that
        # was placed inside the silence
        cands = [
            i for i in range(1, len(line))
            if (pa <= ws_start[i] < pb) or (re.search(r"[,.!?;:]$", line[i - 1][0]) and abs(ws_start[i] - pb) <= 40)
        ]
        if cands:
            i = min(cands, key=lambda q: abs(ws_start[q] - pb))
            ws_start[i] = pb
    for i in range(1, len(line)):
        # keep order: at least ~half an eighth note per word
        ws_start[i] = max(ws_start[i], ws_start[i - 1] + int(P * 0.5))
    ws_start = [min(f, b - 5) for f in ws_start]
    ws = []
    for i, (w, _) in enumerate(line):
        f0 = ws_start[i]
        f1 = ws_start[i + 1] if i + 1 < len(line) else b
        ws.append({"w": w, "start": round(f0 * HOP / SR, 3), "end": round(max(f1, f0 + 5) * HOP / SR, 3)})
    out.append({"text": lines[k], "words": ws})

# --- word refinement with PocketSphinx (optional: pip install pocketsphinx) --------------------
# The beat grid knows WHEN syllables can happen, not WHICH word is sung. PocketSphinx (offline,
# English model bundled in the pip package) forced-aligns the known words of each line on the
# vocals stem. Words it places become anchors; any word it misses keeps its grid position,
# stretched between the anchors around it. Line starts stay from the structure step above.
sphinx_note = "not installed (pip install pocketsphinx for word-level timing)"
try:
    from pocketsphinx import Decoder

    _dec = Decoder(samprate=SR, loglevel="FATAL")
    _pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    matched = total = 0
    for k, item in enumerate(out):
        ws = item["words"]
        total += len(ws)
        clean = [re.sub(r"[^a-z']", "", w["w"].lower()) for w in ws]
        if not all(c and _dec.lookup_word(c) for c in clean):
            continue  # a word the dictionary doesn't know (names, other languages) → keep the grid
        a_sec = ws[0]["start"]
        b_sec = ends[k] * HOP / SR
        w0 = max(0.0, a_sec - 0.25)
        seg = _pcm[int(w0 * SR): int((b_sec + 0.15) * SR)]
        try:
            _dec.set_align_text(" ".join(clean))
            _dec.start_utt()
            _dec.process_raw(seg.tobytes(), full_utt=True)
            _dec.end_utt()
            segs = _dec.seg()
        except Exception:
            segs = None
        if not segs:
            continue
        found = [(re.sub(r"\(\d+\)$", "", sg.word), w0 + sg.start_frame / 100) for sg in segs
                 if sg.word not in ("<s>", "</s>", "<sil>", "(NULL)")]
        anchors = {}  # word index -> time
        j = 0
        for word, t in found:
            while j < len(clean) and clean[j] != word:
                j += 1
            if j < len(clean):
                anchors[j] = t
                j += 1
        # sanity checks — speech recognition is shaky on singing, so an anchor must:
        #  * fall where the singer is actually singing (not inside a breath)
        #  * leave a plausible time per syllable since the previous accepted word (≥ 40 % of a slot)
        syl_w = [line_syl for line_syl in (sum(1 for _ in [0]) * syllables(w["w"]) for w in ws)]
        slot = P * HOP / SR
        def sung(t):
            f = int(t * SR / HOP)
            return voiced[max(0, f - 12): f + 13].any()  # ±0.12 s: hard consonants (k, p, t) are quiet
        good = {0: a_sec}  # the line start comes from the structure step
        last_i, last_t = 0, a_sec
        for i in sorted(anchors):
            t = anchors[i]
            if i == 0 or not (a_sec < t < b_sec - 0.1) or not sung(t):
                continue
            if abs(t - ws[i]["start"]) > 3 * slot * max(1, syl_w[i]):  # wildly off the beat grid
                continue
            # fastest plausible singing = the song's basic pulse (songs mix quarter and eighth notes)
            need = 0.6 * min(slot, base * HOP / SR) * sum(syl_w[last_i:i])
            if t - last_t >= need:
                good[i] = t
                last_i, last_t = i, t
        if len(good) - 1 < max(1, (len(clean) - 1) // 2):
            continue  # too little recognised to trust
        anchors = good
        grid = [w["start"] for w in ws]
        keys = sorted(anchors)
        new = []
        for i in range(len(ws)):
            if i in anchors:
                new.append(anchors[i])
                continue
            lo = max(q for q in keys if q < i)
            hi_keys = [q for q in keys if q > i]
            hi_t = anchors[hi_keys[0]] if hi_keys else b_sec
            hi_g = grid[hi_keys[0]] if hi_keys else b_sec
            span_g = max(1e-3, hi_g - grid[lo])
            new.append(anchors[lo] + (grid[i] - grid[lo]) * (hi_t - anchors[lo]) / span_g)
        for i in range(1, len(new)):  # keep order, ≥ 80 ms per word
            new[i] = max(new[i], new[i - 1] + 0.08)
        for i, w in enumerate(ws):
            w["start"] = round(new[i], 3)
            w["end"] = round(new[i + 1], 3) if i + 1 < len(ws) else round(b_sec, 3)
        matched += len(anchors) - 1
    sphinx_note = f"refined {matched}/{total} words"
except ImportError:
    pass

json.dump({"duration": round(len(x) / SR, 3), "vocal_end": round((last + 1) * HOP / SR, 3),
           "beat": round((2 * base if base * HOP / SR < 0.4 else base) * HOP / SR, 4) if rhythmic else None, "method": "vocals-energy", "lines": out},
          open(out_path, "w"), indent=1)
print(f"rhythm: pulse {base * HOP / SR:.3f}s{' (from instrumental)' if instrumental else ''}, one syllable ≈ {P * HOP / SR:.3f}s" + ("" if rhythmic else " — weak beat, proportional timing"))
print(f"structure: {structure or 'not detected — proportional line timing'}")
print(f"pocketsphinx: {sphinx_note}")
print(f"vocals-stem timing: singing {first * HOP / SR:.1f}s → {(last + 1) * HOP / SR:.1f}s, {len(lines)} lines, {len(pauses)} pauses → {out_path}")
for l in out:
    print(f"  {l['words'][0]['start']:6.2f}s  " + " ".join(f"{w['w']}@{w['start']:.2f}" for w in l["words"]))
