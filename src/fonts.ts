import { continueRender, delayRender, staticFile } from "remotion";

const faces: [string, string, string, string?][] = [
  ["Fredoka", "fredoka-latin-600-normal.woff2", "600"],
  ["Fredoka", "fredoka-latin-700-normal.woff2", "700"],
  ["Fredoka", "fredoka-latin-ext-700-normal.woff2", "700", "U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0"],
  ["Baloo", "baloo-2-latin-800-normal.woff2", "800"],
  ["Baloo", "baloo-2-latin-ext-800-normal.woff2", "800", "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF"],
  ["Baloo", "baloo-2-vietnamese-800-normal.woff2", "800", "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB"],
  ["NotoThai", "noto-sans-thai-thai-700-normal.woff2", "700"],
  ["NotoArabic", "noto-sans-arabic-arabic-700-normal.woff2", "700"],
];

let loaded = false;
export const loadFonts = () => {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const handle = delayRender("fonts", { timeoutInMilliseconds: 120000, retries: 2 });
  Promise.all(
    faces.map(([family, file, weight, range]) => {
      const f = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {
        weight,
        unicodeRange: range,
      });
      return f.load().then((ff) => document.fonts.add(ff));
    }),
  )
    .catch((e) => console.error("font load failed", e))
    .finally(() => continueRender(handle));
};

/** Display font: rounded & bold, like the channel's Canva style. Vietnamese falls through to Baloo. */
export const DISPLAY = `"Fredoka", "Baloo", "NotoThai", "NotoArabic", "Noto Sans CJK JP", "Hiragino Sans", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
/** Lyric font: Baloo has full Vietnamese coverage. */
export const LYRIC = `"Baloo", "Fredoka", "NotoThai", "NotoArabic", "Noto Sans CJK JP", "Hiragino Sans", sans-serif`;
