# Danh sách video

Tiến độ thật của từng video luôn xem bằng `npm run status`, vì lệnh này đọc trực tiếp từ các file. Bảng dưới đây là ảnh chụp ngày **20/10/2026**.

Ký hiệu: ✅ đã có · ⏳ cần làm · — không áp dụng

## Đợt 1: hai video đầu

| Slug | Video | Dạng | Bài hát | Đã render |
|---|---|---|---|---|
| `animal-sounds-around-the-world` | Animal Sounds Around the World | vocab (đoán tiếng kêu) + 5 nước | ✅ | ✅ bản cũ, cần render lại để có âm lượng mới và phần hát lại |
| `counting-fruits` | Counting Fruits 1 to 10 | counting | ✅ | ✅ bản cũ, cần render lại |
| `hello-around-the-world` | Hello Around the World | countries | — chỉ dùng nhạc nền demo | ⏳ |

## Đợt 2

| Slug | Video | Dạng | Bài hát (Mureka) |
|---|---|---|---|
| `vehicle-sounds` | Beep Beep! Vehicle Sounds | vocab, trò đoán âm thanh | ✅ |
| `rainbow-colors` | Colors of the Rainbow | colors | ✅ |
| `morning-routine` | Good Morning Routine | vocab, các bước buổi sáng | ✅ |
| `animal-freeze-dance` | Animal Freeze Dance | action / freeze dance | ✅ (style dance 120 bpm) |
| `abc-phonics` | ABC Phonics A to Z | abc, 26 chữ cái | ✅ |

## Đợt 3

| Slug | Video | Dạng | Bài hát (Mureka) |
|---|---|---|---|
| `shapes-song` | Shapes Song | vocab, 8 hình | ✅ |
| `ocean-animals` | Under the Sea | vocab, 8 con vật biển kèm điều thú vị | ✅ |
| `feelings-song` | Feelings Song | vocab, 8 cảm xúc | ✅ |
| `days-of-the-week` | Days of the Week | vocab, 7 ngày | ✅ |
| `body-parts` | My Body Song | vocab + lời hát có động tác | ✅ (style action 115 bpm) |

## Đợt 4

| Slug | Video | Dạng | Bài hát (Mureka) |
|---|---|---|---|
| `jungle-animals` | Jungle Animal Sounds | vocab, trò đoán tiếng kêu | ✅ |
| `counting-in-space` | Counting in Space 1 to 10 | counting | ✅ |
| `weather-song` | Weather Song | vocab, 8 kiểu thời tiết | ⏳ |
| `wash-your-hands` | Wash Your Hands | vocab, các bước rửa tay | ⏳ |
| `bedtime-song` | Good Night Song | vocab, lullaby 80 bpm | ⏳ (style ru ngủ) |
| `vegetables-song` | Vegetables Song | vocab, 8 loại rau | ⏳ |
| `opposites-song` | Opposites Song | vocab, 5 cặp từ trái nghĩa | ⏳ |
| `family-song` | My Family Song | vocab, 8 thành viên | ⏳ |
| `months-of-the-year` | Months of the Year | vocab, 12 tháng | ⏳ |
| `community-helpers` | Community Helpers | vocab, 8 nghề | ⏳ |

Lời và style để dán vào Mureka nằm trong `content/<slug>.mureka-lyrics.txt` và `content/<slug>.mureka-style.txt`.

## Ghi chú khi tạo nhạc

- Mỗi video có style riêng trong `meta.musicStyle` (xem `scripts/music.ts`). Style tương ứng đã nằm sẵn trong `content/<slug>.mureka-style.txt`, chỉ cần dán vào Mureka.
- Style của các bài còn chờ nhạc:

| Bài | Style |
|---|---|
| weather | `reggae` |
| vegetables | `country` |
| opposites | `kid-voice` |
| months | `marching` |
| community helpers | `bright-pop` |
| wash your hands | `bright-pop` |
| bedtime | `lullaby` |
| family | `ukulele-pop` |

- Mỗi dòng lời nên dưới khoảng 37 ký tự, nếu dài hơn chữ trên màn hình sẽ bị xuống dòng.
- Chọn bản dài khoảng 1:05–1:25 và hát đủ lời. Bản dài 2 phút thường bị lặp lại.

## Playlist trên kênh

Mỗi video ghi playlist của nó trong `meta.playlists`. `06-upload` tự tạo playlist nếu chưa có và thêm video vào. `08-compile --theme="…"` dùng các playlist này để làm video tổng hợp.

| Playlist | Video |
|---|---|
| Animal Songs | animal sounds, jungle, ocean, freeze dance |
| Numbers, Letters & Shapes | counting fruits, counting in space, ABC, shapes, opposites |
| Daily Routines & Feelings | morning routine, wash your hands, bedtime, feelings, family |
| Dance & Move | freeze dance, body parts |
| Learn English Words | vehicles, colors, days, months, weather, vegetables, community helpers, family |
| Around the World | animal sounds, hello around the world |

## Ý tưởng tiếp theo

- Farm animals: trò đoán tiếng kêu ở nông trại
- Dinosaurs: đã có mẫu `content/dinosaurs.example.json`, nên dùng hình AI vì emoji chỉ có 2 con khủng long
- Fruits A–Z, Bugs & insects, Musical instruments, Seasons, Transportation sounds 2 (tàu thuỷ, trực thăng)
- Bài theo dịp: Halloween (tháng 10), Christmas (tháng 12), Tết / Lunar New Year (tháng 1–2)
- Các video tổng hợp 20–30 phút sau khi có 8–10 bài, bằng `08-compile.ts`

## Việc kỹ thuật

- [x] Cân âm lượng cho video dài và Shorts
- [x] Bỏ mọi câu kêu gọi bình luận (video Made for Kids), thay bằng thẻ "Your turn!" để bé làm theo
- [x] Xoay vòng style nhạc theo từng video
- [x] Video tổng hợp theo playlist, video phát vòng cho livestream (`--hours`)
- [x] 3 bố cục thumbnail để dùng với Test & compare
- [x] Track lồng tiếng nhiều ngôn ngữ (`09-dub`)
- [ ] Chữ lời karaoke to hơn khoảng 20–30% cho dễ đọc trên điện thoại
- [ ] Dùng hình AI cho các thẻ đang dùng emoji (khoảng $0.3–0.5 mỗi video)
