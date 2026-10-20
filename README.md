# Kids Video Factory: video thiếu nhi kiểu "Meo with Pi" bằng AI

Pipeline làm video bài hát thiếu nhi cho kênh **Meo with Pi** (@MeowPi): viết nội dung, giọng đọc, căn lời karaoke theo nhạc, dựng video bằng code (Remotion/React), làm thumbnail, chapters, Shorts và upload YouTube.

Cấu trúc một video:

`Intro` → `Bài hát (karaoke)` → `Thẻ tiêu đề` → `Thẻ học` (điệp khúc chen giữa các nhóm) → `Let's sing it again!` (hát lại cả bài) → `Spread the love` → `Subscribe`

```
ý tưởng ─▶ 01 nội dung (Groq/Claude) ─▶ content/<slug>.json   ◀── nguồn sự thật, sửa tay được
               ├─▶ 02 hình AI (OpenAI, tuỳ chọn)            public/<slug>/scene-XX.png
               ├─▶ 03 giọng đọc (edge-tts miễn phí)          public/<slug>/voice-XX.mp3
   Mureka (web) ─▶ public/<slug>/song.mp3
               ├─▶ 04 tách giọng (Demucs) + căn lời (stable-ts) → thời gian từng chữ
               ├─▶ 05 render: cân âm lượng, hát lại, chapters, thumbnail, MP4 1080p
               ├─▶ 06 upload YouTube (private, Made for Kids) — tuỳ chọn
               ├─▶ 07 Shorts dọc (tuỳ chọn)
               └─▶ 08 video tổng hợp 20–60 phút (tuỳ chọn)
```

Danh sách video và ý tưởng: [docs/VIDEOS.md](docs/VIDEOS.md). Xem tiến độ từng video: `npm run status`.

---

## 1. Cài đặt (một lần)

```bash
npm install                                   # Node ≥ 22, cần ffmpeg (brew install ffmpeg)
cp .env.example .env                          # mặc định đã là cấu hình miễn phí

# Python cho căn lời + giọng đọc (Python 3.11; 3.13 làm stable-ts crash trên macOS)
conda create -y -n align python=3.11
conda run -n align pip install stable-ts pocketsphinx demucs edge-tts
```

Trong `.env`, trỏ `PYTHON` tới môi trường vừa tạo:

```
PYTHON=/opt/miniconda3/envs/align/bin/python
```

Không cần API key nào để làm video: không có `OPENAI_API_KEY` thì dùng emoji thay hình, giọng đọc dùng edge-tts miễn phí. Chỉ bước 1 (viết nội dung tự động) cần `GROQ_API_KEY` (miễn phí) hoặc `ANTHROPIC_API_KEY`.

## 2. Quy trình làm một video

**Bước A. Nội dung.** Có 2 cách:
- Tự động: `npm run make -- "Dinosaurs" --style=vocab`. Bước 1 viết `content/dinosaurs.json`, sau đó chạy tiếp bước 2–3 rồi dừng chờ bài hát.
- Có sẵn: các file trong `content/` (xem [docs/VIDEOS.md](docs/VIDEOS.md)). Mỗi video có thêm:
  - `<slug>.mureka-lyrics.txt`: lời có đánh dấu [Verse]/[Chorus], dán vào ô Lyrics của Mureka
  - `<slug>.mureka-style.txt`: style, dán vào ô Style
  - `<slug>.lyrics.txt`: lời trần, dùng để căn lời

**Bước B. Bài hát (Mureka, trang web).** Vào mureka.ai, chọn Create, tab Custom:
1. Dán lời vào **Lyrics** và style vào **Style**, chọn giọng **Female**, đặt tên bài, bấm **Create**. Mỗi lần tạo tốn khoảng 20 Gold và ra 2 bản.
2. Nghe cả 2 bản, chọn bản hát đủ và rõ lời. Thường bản dài 1:05–1:25 là ổn; bản quá dài hay lặp lại hoặc kéo dài phần nhạc cuối.
3. Bấm biểu tượng tải xuống, chọn **MP3**, rồi lưu thành `public/<slug>/song.mp3`.
4. Ở cùng menu đó, chọn **Commercial License** để tải giấy phép thương mại, lưu vào `licenses/<slug>.pdf`. Xem mục 7.

**Bước C. Căn lời và render.**

```bash
npm run make -- <slug> --from=3      # giọng đọc → căn lời → render
npm run make -- <slug> --from=5      # chỉ render lại (sau khi sửa JSON hoặc code)
npm run make -- <slug> --from=4 --force   # căn lời lại từ đầu (đã thay song.mp3)
```

Kết quả nằm trong `out/<slug>/`:
- `<slug>.mp4`: video 1080p, 30fps, âm lượng −14 LUFS
- `thumbnail.jpg`: thumbnail 1280×720
- `youtube.json`: tiêu đề, mô tả có chapters, tags

**Bước D. Xem lại rồi đăng.**
- `npm run studio` để xem và sửa trực tiếp, không cần render. Composition **KidsVideo** là video, **Thumbnail** là ảnh thumbnail.
- `--preview` render ở nửa độ phân giải để xem nhanh.
- Upload: `npm run make -- <slug> --from=6 --upload` (cần `npm run youtube:auth` một lần), hoặc tự đăng trong YouTube Studio. Xem checklist ở mục 8.

## 3. Bước render tự làm thêm những gì

| Phần | Làm gì | Ở đâu |
|---|---|---|
| Cân âm lượng | Bài hát, giọng đọc và nhạc nền về cùng −16 LUFS (bản copy trong `public/.norm/`). Cả video sau đó chỉnh về −14 LUFS theo chuẩn YouTube, nên phần học không còn nhỏ hơn phần hát. | `scripts/audio.ts` |
| Điệp khúc chen giữa | Điệp khúc (có karaoke) quay lại giữa các nhóm thẻ học, tối đa 3 lần | `src/arrange.ts` |
| Hát lại | "Let's sing it again!" rồi hát lại cả bài trước phần chào tạm biệt | `src/arrange.ts` |
| Chapters | Mỗi nhóm thẻ một chapter (Dog 🐶, Numbers 1–3, Sing Along Again 🎤…) | `src/arrange.ts` |
| Thumbnail | Tiêu đề chữ to nhiều màu, 3 hình chủ đề, 2 bé, nền tia nắng (màu đổi theo video) | `src/Thumbnail.tsx` |
| Hiệu ứng | Chuyển cảnh (pop/slide/iris/zoom/swing), camera trôi nhẹ, hạt bay theo nền, pháo giấy ở điệp khúc, các bé lắc lư theo nhịp | `src/components/Motion.tsx` |

Các phần chen giữa và hát lại chỉ được thêm lúc render, không ghi vào JSON. Tuỳ chỉnh từng video trong JSON:

```jsonc
"extras": { "singAgain": false, "chorusBreaks": false, "maxBreaks": 2 },
"meta": { "thumbnail": { "title": "Months of the Year", "items": ["🌸", "🎂", "🎄"] } }
// mỗi cảnh: "transition": "iris" | "pop" | "slide" | "slideUp" | "zoom" | "swing"
//           "fx": "bubbles" | "petals" | "sparkles" | "confetti" | "snow" | "hearts" | "notes" | "none"
```

### Intro / outro riêng của kênh (tuỳ chọn)

Đặt video của bạn vào `public/brand/` (`.mp4`, `.mov`, `.webm`, `.m4v` đều được), mọi video render sau đó sẽ tự dùng:

| File | Thay cho |
|---|---|
| `public/brand/intro.mp4` | thẻ intro "Meo with Pi" có sẵn |
| `public/brand/outro.mp4` | thẻ "Spread the love" và "Subscribe" có sẵn |

- Không có file thì video dùng intro và outro có sẵn như cũ.
- Clip được phát nguyên vẹn, không thêm hiệu ứng. Nếu khác tỉ lệ 16:9 thì có viền đen.
- Âm thanh của clip được cân về cùng độ to với bài hát. Nhạc nền tắt trong lúc clip chạy.
- Chapters, thời điểm bắt đầu bài hát và video tổng hợp tự tính lại theo độ dài clip.
- Tuỳ chỉnh từng video trong JSON:

```jsonc
"brand": { "intro": "brand/intro-halloween.mp4" }   // dùng clip khác cho video này
"brand": { "outro": false }                         // video này dùng outro có sẵn
"brand": { "outroReplaces": "subscribe" }           // giữ "Spread the love", chỉ thay Subscribe
```

Clip chỉ xuất hiện khi render (`--from=5` hoặc `--preview`), còn `npm run studio` vẫn hiện intro có sẵn. File clip không được đưa lên git, nên hãy giữ một bản sao ở nơi khác.

## 4. Căn lời (bước 4)

Tự chọn cách tốt nhất đang có:
1. **stable-ts (Whisper)** chạy trên **vocals stem**: khớp từng chữ. Demucs tự tách giọng mỗi khi `song.mp3` mới hơn file stem cũ. Sau đó có một bước dọn: chữ bị đặt vào đoạn nhạc dạo sẽ được kéo về đúng chỗ, và một câu không được vắt qua quãng nghỉ dài.
2. **Vocals stem, không cần model** (`ALIGNER=vocals`): tự đo nhịp bài, đặt âm tiết theo phách, rồi dùng PocketSphinx neo những chữ nghe chắc chắn.
3. **Chia đều**: chỉ dùng khi không có cả hai cách trên, karaoke sẽ lệch.

Ngoài ra:
- Phần nhạc dạo dài ở cuối bài được cắt bớt (`SONG_TAIL`, mặc định 2.5 giây sau câu hát cuối).
- Phần học dùng **bản không lời của chính bài hát** (`instrumental.mp3`, tách tự động) làm nhạc nền. Nhạc nền nhỏ lại khi có lời dẫn.

Nếu lời vẫn lệch ở vài chữ, mở `content/<slug>.json` và sửa `start` của chữ đó (tính bằng giây từ đầu cảnh), rồi render lại với `--from=5`.

## 5. Các định dạng (`--style`)

| `--style` | Video | Thẻ học |
|---|---|---|
| `vocab` | Từ vựng theo chủ đề, có thể thêm trò đoán "Who says MOO?" | `vocab` (có `guess` thì là trò đoán) |
| `countries` | Chào hỏi hoặc tiếng kêu theo từng nước | `country` |
| `counting` | Đếm 1 → 10 | `count`: đồ vật hiện lần lượt |
| `colors` | Màu sắc | `color`: vệt màu và 3 đồ vật |
| `abc` | ABC / phonics | `letter`: "A is for Apple /æ/" |
| `action` | Bài vận động / freeze dance | `action` + lời hát có `action` |

Các loại cảnh khác: `intro`, `lyric` (nền: sky, meadow, sea, desert, globe, blocks, image, video), `title`, `outro`, `subscribe`. Định nghĩa đầy đủ trong `src/schema.ts`. Nhân vật là các bé vẽ vector chỉnh qua `look` (da, tóc, trang phục, mũ, cờ), hoặc ảnh AI qua `characters: [{ "image": "slug/x.png" }]`.

## 6. Shorts và video tổng hợp

- **Shorts:** `npx tsx scripts/07-shorts.ts <slug>` (thêm `--list` để chỉ xem kế hoạch cắt). Script tự cắt các Short dọc dưới 59 giây: một Short bài hát và mỗi nhóm thẻ một Short. Dùng Shorts để kéo người xem về video dài.
- **Video tổng hợp:** `npx tsx scripts/08-compile.ts <tên> <slug> <slug> … [--repeat=2]` ghép nhiều video thành một video 20–60 phút có chapters. Video dài là nơi kênh thiếu nhi có nhiều thời gian xem nhất.

## 7. Chi phí và bản quyền nhạc

**Chi phí cho mỗi video (thực tế):**
- Pipeline: $0. Nội dung dùng Groq (miễn phí), giọng edge-tts miễn phí, render trên máy.
- Hình AI (tuỳ chọn): khoảng $0.02–0.04/ảnh với `gpt-image-1-mini`.
- Nhạc Mureka: gói Pro khoảng S$99/năm, được 5.000 Gold/tháng, mỗi lần tạo bài khoảng 20 Gold, tức khoảng 250 bài/tháng. Mỗi ngày còn có khoảng 50 Gold miễn phí, hết hạn sau 1 ngày.
- ⚠️ **Đừng tạo video (MV) trên Mureka.** Một lần render MV tốn khoảng 400 Gold, trong khi pipeline này làm video miễn phí.

**Quyền thương mại:**
- Theo điều khoản của Mureka (13/05/2026, mục 3(e)), bài tạo **trong lúc đang dùng gói trả phí** thuộc về người tạo.
- Bài tạo ở gói miễn phí chỉ được dùng phi thương mại.
- Bot hỗ trợ của Mureka xác nhận quyền thương mại vẫn giữ sau khi huỷ gói. Bằng chứng là **Commercial License certificate**, phải tải về **khi gói còn hiệu lực**. Lưu mỗi bài một file trong `licenses/`.
- Phải ghi rõ nhạc do AI tạo.

## 8. Checklist trước khi đăng

- [ ] Xem hết video: lời khớp nhạc, chữ không bị tràn, không có cảnh trắng.
- [ ] Đã tải Commercial License certificate của bài hát (`licenses/<slug>.pdf`).
- [ ] Trong YouTube Studio:
  - [ ] Chọn **Made for Kids**.
  - [ ] Tick **Altered or synthetic content**, vì nhạc và giọng do AI tạo.
  - [ ] Thêm end screen ở 20 giây cuối.
- [ ] Dán mô tả có chapters từ `out/<slug>/youtube.json` và dùng `thumbnail.jpg`.
- [ ] Lời bài hát là sáng tác mới. Không dùng lời của bài thiếu nhi còn bản quyền.
- [ ] Đăng đều đặn với số lượng vừa phải. YouTube đang siết "inauthentic content" (nội dung làm hàng loạt). Mỗi video cần có ý tưởng và bài hát riêng, và nên đổi style nhạc giữa các video.

## 9. Gỡ lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `OMP: Error #15` hoặc stable-ts crash | Dùng môi trường conda Python 3.11 (mục 1) và đặt `PYTHON=` trong `.env`. Có thể tạm dùng `ALIGNER=vocals`. |
| Lời karaoke chậm hoặc nhanh hơn nhạc | `npm run make -- <slug> --from=4 --force`. Nếu vẫn lệch vài chữ thì sửa `start` trong JSON. |
| Đổi bài hát mà lời vẫn theo bài cũ | Chạy `--from=4 --force`. Stem cũ sẽ tự bị tách lại. |
| Phần học không có nhạc nền | Cần `instrumental.mp3`: chạy lại bước 4, Demucs sẽ tự tạo. |
| Tải MP3 trên Mureka không ra file | Brave có thể đang hiện hộp "Save as" hoặc "cho phép tải nhiều file". Hãy cho phép, rồi chuyển file vào `public/<slug>/song.mp3`. |
| Chữ bị nhảy dòng | Rút ngắn dòng lời. Nên giữ mỗi dòng dưới khoảng 37 ký tự. |

## Cấu trúc thư mục

```
content/            <slug>.json (+ lời cho Mureka), examples/ — nguồn sự thật cho mỗi video
public/<slug>/      song.mp3, instrumental.mp3, voice-XX.mp3, scene-XX.png (không đưa lên git)
public/flags, fonts, demo   tài nguyên dùng chung
src/                Remotion: Video.tsx, Thumbnail.tsx, Short.tsx, arrange.ts, schema.ts, scenes/, components/
scripts/            01…08 các bước, make.ts (chạy cả chuỗi), status.ts, audio.ts, brand.ts, align*.py, tts.py
public/brand/       intro.mp4 / outro.mp4 riêng của kênh (tuỳ chọn, không đưa lên git)
out/<slug>/         video, thumbnail, youtube.json (không đưa lên git)
docs/VIDEOS.md      danh sách video, ý tưởng, kế hoạch
```
