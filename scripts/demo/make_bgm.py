"""Placeholder ukulele-style backing loop (C-G-Am-F, 112 bpm) so the demo isn't silent.
In the real pipeline this is replaced by a Suno song + a royalty-free bgm."""
import sys, wave
import numpy as np

SR = 44100
BPM = 112
beat = 60 / BPM
dur = float(sys.argv[2]) if len(sys.argv) > 2 else 70
out = np.zeros(int(SR * (dur + 2)))

def note(f, length, amp=0.2, decay=4.0, harmonics=(1, .5, .3, .15, .08)):
    t = np.arange(int(SR * length)) / SR
    s = sum(a * np.sin(2 * np.pi * f * (k + 1) * t) for k, a in enumerate(harmonics))
    env = np.exp(-decay * t) * np.minimum(1, t * 200)
    return amp * s * env

def add(sig, at):
    i = int(at * SR)
    j = min(len(out), i + len(sig))
    out[i:j] += sig[: j - i]

hz = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]]
bass = [36, 43, 45, 41]
melody = [72, 74, 76, 79, 76, 74, 72, None, 71, 72, 74, 76, 74, 72, 71, None,
          69, 71, 72, 76, 72, 71, 69, None, 65, 67, 69, 72, 71, 69, 67, None]
strum = [0, 1, 1.5, 2, 3, 3.5]
t = 0.0; bar = 0
while t < dur:
    c = chords[bar % 4]
    for b in strum:
        for k, m in enumerate(c):
            add(note(hz(m), 1.2, 0.05, 5.5), t + b * beat + k * 0.012)
    add(note(hz(bass[bar % 4]), beat * 1.8, 0.25, 2.5, (1, .3, .1)), t)
    add(note(hz(bass[bar % 4] + 7), beat * 1.8, 0.2, 2.5, (1, .3, .1)), t + 2 * beat)
    for i in range(8):
        m = melody[(bar % 4) * 8 + i]
        if m: add(note(hz(m), beat, 0.09, 3.5, (1, .2, .05)), t + i * beat / 2)
    # soft shaker
    for i in range(8):
        n = np.random.randn(int(SR * 0.05)) * np.exp(-np.arange(int(SR * 0.05)) / SR * 90) * (0.03 if i % 2 else 0.015)
        add(n, t + i * beat / 2)
    t += 4 * beat; bar += 1

fade = int(SR * 2)
out[int(dur * SR) - fade:int(dur * SR)] *= np.linspace(1, 0, fade)
out = out[: int(dur * SR)]
out = out / np.max(np.abs(out)) * 0.8
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
