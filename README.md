# Kids Video Factory: làm video thiếu nhi kiểu MeowPi bằng AI

Từ một chủ đề, pipeline tạo ra kịch bản, hình, giọng đọc và nhạc, sau đó dựng video bằng code (Remotion/React) rồi upload YouTube ở chế độ private.
Template đi theo đúng cấu trúc video mẫu của kênh:

`Intro "Meo with Pi"` → `Bài hát (lời karaoke chạy theo nhạc)` → `Thẻ tiêu đề` → `Thẻ học (quốc gia / từ vựng)` → `Spread the love` → `Subscribe`

```
topic ─▶ 01 Claude ─▶ content/<slug>.json ◀── nguồn sự thật, sửa tay được
             │
             ├─▶ 02 hình AI (OpenAI, tuỳ chọn)        public/<slug>/scene-XX.png
             ├─▶ 03 giọng đọc (ElevenLabs)            public/<slug>/voice-XX.mp3
             ├─▶ 04 bài hát (Suno, thủ công) + căn lời (stable-ts)
             ├─▶ 05 render MP4 + thumbnail + chapters (Remotion)
             └─▶ 06 upload YouTube (private, Made for Kids)
```

## Cài đặt (một lần)

```bash
npm install                      # Node ≥ 22
pip install -U stable-ts         # để căn lời theo nhạc (cần ffmpeg)
cp .env.example .env             # điền API key
npm run studio                   # mở trình xem trước, chỉnh trực tiếp
```

## Xem thử video ngay, không cần API key nào

```bash
pip install edge-tts              # giọng đọc miễn phí
cp .env.example .env              # mặc định đã là cấu hình miễn phí
npm run make -- animal-sounds-around-the-world --from=2
```
Lệnh trên chạy bước 2 → 5 rồi dừng, **không upload**. Video ra ở `out/animal-sounds-around-the-world/`.
- Bước 2 (hình AI) tự bỏ qua khi chưa có `OPENAI_API_KEY`, video dùng emoji thay hình.
- Bước 3 dùng giọng edge miễn phí. `TTS_PROVIDER=kokoro` chạy offline, `none` bỏ hẳn lời dẫn.
- Bước 4 căn lời theo nhạc, chọn cách tốt nhất đang có:
  1. `stable-ts` (`pip install -U stable-ts`): khớp từng chữ.
  2. Không có stable-ts (hoặc đặt `ALIGNER=vocals`) nhưng có **vocals stem** (`demucs --two-stems=vocals song.mp3`, file `vocals.wav` nằm bất kỳ đâu trong `public/<slug>/`): tự nhận nhịp bài hát, đặt mỗi âm tiết vào một phách rồi khớp với chỗ giọng hát bắt đầu. Không cần tải model.
  3. Không có cả hai: chia đều, karaoke sẽ lệch.
  Phần nhạc dạo dài ở cuối bài Suno được cắt bớt và nhỏ dần (`SONG_TAIL`, mặc định 2.5 giây sau câu hát cuối).
- Bước 6 (upload) chỉ chạy khi thêm `--upload`.

## Làm một video mới

```bash
# 1→4: viết nội dung, tạo hình, giọng đọc, xuất lời cho Suno (rồi tạm dừng)
npm run make -- "Dinosaurs" --style=vocab        # bước 1 dùng Groq (miễn phí) hoặc Claude, xem .env
npm run make -- "Hello around the world" --style=countries --items=10

# Lên Suno (Create → Custom), dán nội dung content/<slug>.suno.txt,
# chọn bản hay nhất rồi lưu thành public/<slug>/song.mp3

# 4→6: căn lời, render, upload
npm run make -- <slug> --from=4 --upload
```

Trước bước render, nên mở `npm run studio` để xem lại. Chỗ nào chưa ưng thì sửa thẳng trong `content/<slug>.json` (lời, màu, trang phục, thời lượng), preview sẽ cập nhật ngay.

## Các định dạng (`--style`)

Chọn dựa trên những gì đang hút view nhất trên YouTube thiếu nhi năm 2026 (D Billions, ChuChu TV, Super Simple Songs, Cocomelon…):

| `--style` | Video | Phần học |
|---|---|---|
| `vocab` | Từ vựng theo chủ đề (con vật, khủng long…), có thể thêm trò đoán "Who says MOO?" | thẻ `vocab` |
| `countries` | Chào hỏi / văn hoá các nước | thẻ `country` |
| `counting` | Đếm số 1 → 10 | thẻ `count`: đồ vật hiện lần lượt, số đếm tăng dần |
| `colors` | Học màu sắc | thẻ `color`: vệt màu và 3 đồ vật cùng màu |
| `abc` | ABC / phonics "A is for Apple" | thẻ `letter` |
| `action` | Bài hát vận động / freeze dance: các bé nhảy, vỗ tay, xoay theo nhịp, rồi "FREEZE!" | thẻ `action` + lời bài hát có `action` |

Các thẻ mới chỉ dùng emoji nên không tốn tiền tạo hình. Mỗi định dạng có file mẫu trong `content/examples/`.

```bash
npm run make -- "Counting fruits" --style=counting
npm run make -- "Freeze dance" --style=action
```

Với bài hát vận động, bước 4 tự đo nhịp bài hát rồi cho các bé nhảy hoặc vỗ tay đúng phách.

## Shorts và video tổng hợp

- **Shorts** (`npx tsx scripts/07-shorts.ts <slug>`, hoặc thêm `--shorts` vào `make`): tự cắt video thành các Short dọc dưới 59 giây, gồm một Short bài hát và mỗi nhóm thẻ học một Short (ví dụ "Who says WOOF? 🤔"). Thêm `--list` để chỉ xem trước kế hoạch cắt. Nên dùng Shorts để kéo người xem về video dài.
- **Video tổng hợp** (`npx tsx scripts/08-compile.ts <tên> <slug> <slug> … [--repeat=2]`): nối nhiều video thành một video 20–60 phút có chapters. Chỉ giữ intro của video đầu và nút subscribe của video cuối. Video dài là nơi kênh thiếu nhi kiếm được nhiều thời gian xem nhất.

## Âm thanh: vì sao bài hát ngắn hơn video?

Bài hát (khoảng 1 phút) **chỉ phủ phần hát**. Phần học phía sau dài hơn nhiều, gồm thẻ quốc gia/từ vựng và lời dẫn, và được phát trên **nhạc nền lặp lại** (`audio.bgm`).
- Tốt nhất là dùng **bản không lời của chính bài hát**: trên Suno, mở bài hát → *Get Stems* (hoặc tạo lại bài với nút *Instrumental*). Lưu thành `public/<slug>/instrumental.mp3`, bước 04 sẽ tự nhận file này.
- Nhạc nền tự nhỏ lại khi có giọng đọc (`bgmDuck`), tắt dần khi bài hát bắt đầu và mờ dần ở cuối video.

## Bước render tự làm thêm những gì (`05-render`)

- **Cân âm lượng:** bài hát, giọng đọc và nhạc nền được đưa về cùng độ to (−16 LUFS, bản copy nằm ở `public/.norm/`), sau đó cả video được chỉnh về −14 LUFS theo chuẩn YouTube. Phần học không còn nhỏ hơn phần hát.
- **Hát lại và điệp khúc xen kẽ** (`src/arrange.ts`): điệp khúc chen vào giữa các nhóm thẻ học (tối đa 3 lần), và cả bài được hát lại một lần trước phần chào tạm biệt ("Let's sing it again!"). Các cảnh này chỉ thêm lúc render, không ghi vào file JSON. Muốn tắt thì thêm vào JSON: `"extras": { "singAgain": false, "chorusBreaks": false }`.
- **Chapters:** mỗi nhóm thẻ là một chapter riêng (Dog 🐶, Numbers 1–3, Sing Along Again 🎤…), ghi trong `out/<slug>/youtube.json`.
- **Thumbnail riêng** (`src/Thumbnail.tsx`): tiêu đề chữ to nhiều màu, 3 hình chủ đề và 2 bé trên nền tia nắng. Muốn đổi thì thêm `"thumbnail": { "title": "…", "items": ["🌸", "🎂", "🎄"] }` vào `meta`.

## Các loại cảnh (`src/schema.ts`)

| type | Dùng cho | Trường chính |
|---|---|---|
| `intro` | Thẻ mở đầu kênh | `title`, `subtitle`, `handle` |
| `lyric` | Phần bài hát | `lines` (karaoke), `background.kind`: sky / meadow / sea / desert / globe / blocks / image / video, `textPosition`, `textStyle`: outline / box |
| `title` | "Hello everyone, welcome to…" | `small[]`, `big` |
| `country` | Chào hỏi theo quốc gia | `layout`: poster / quad, `flag` (mã ISO), `greeting`, `native`, `romanization` |
| `vocab` | Từ vựng (khủng long, con vật…) | `word`, `sub`, `image` |
| `outro`, `subscribe` | Kết video | |

**Nhân vật:** nếu không có ảnh AI, video dùng một bé vector có sẵn, chỉnh qua `look` (da, tóc, kiểu tóc, `outfit`: shirtPants / dress / tunic, mũ: conical (nón lá), beret, kokoshnik, flowerCrown, bow, headscarf…, `flag`).
Nếu đã có ảnh, đặt `characters: [{ "image": "slug/xxx.png" }]`.

**Giữ style hình đồng nhất:** bỏ 1–3 ảnh mẫu theo đúng style kênh vào `public/brand/ref-*.png`. Bước 02 sẽ gửi các ảnh này làm tham chiếu cho mọi lần tạo hình.

## Chi phí ước tính cho mỗi video

Claude khoảng $0.1 · ảnh khoảng $0.04/ảnh · ElevenLabs và Suno tính theo gói tháng (cần gói trả phí thì mới được dùng thương mại) · render chạy trên máy nhà.

## Lưu ý trước khi đăng

- **Lời bài hát phải là sáng tác mới.** Prompt ở bước 01 đã yêu cầu vậy. Không dùng lại lời của các bài thiếu nhi còn bản quyền.
- **Mỗi video phải có giá trị riêng.** YouTube đang siết "inauthentic content" (nội dung làm hàng loạt từ template). Pipeline này giúp bỏ bớt việc tay chân, nhưng ý tưởng, bài hát và khâu duyệt vẫn cần người làm. Đăng đều đặn với số lượng vừa phải.
- Video được upload ở chế độ **private**. Duyệt lại trong YouTube Studio rồi mới publish.
