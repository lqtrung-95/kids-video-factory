"""Builds content/animal-sounds-around-the-world.json (hand-checked onomatopoeia)."""
import json

LOOKS = {
  "vn": [{"flag":"vn","outfit":"tunic","top":"#D62828","bottom":"#FFFFFF","accent":"#FFD166","hairStyle":"long","hat":"conical","hatColor":"#EAD8A4"},
         {"flag":"vn","outfit":"tunic","top":"#1D4E89","bottom":"#FFFFFF","accent":"#FFD166"}],
  "jp": [{"flag":"jp","outfit":"dress","top":"#F7A1C4","bottom":"#C2185B","accent":"#FFE9A8","hairStyle":"bun","hair":"#1B1B1B"},
         {"flag":"jp","outfit":"tunic","top":"#2B3A67","bottom":"#8D99AE","accent":"#FFFFFF","hair":"#1B1B1B"}],
  "kr": [{"flag":"kr","outfit":"dress","top":"#F06292","bottom":"#3949AB","accent":"#FFF59D","hairStyle":"long","hat":"bow","hatColor":"#E53935","hair":"#1B1B1B"},
         {"flag":"kr","outfit":"tunic","top":"#43A047","bottom":"#90CAF9","accent":"#FFFFFF","hair":"#1B1B1B"}],
  "fr": [{"flag":"fr","top":"#FFFFFF","bottom":"#1B1B1B","accent":"#D62828","hat":"beret","hatColor":"#1B1B1B","hair":"#8B5A2B"},
         {"flag":"fr","outfit":"dress","top":"#C1121F","bottom":"#1B1B1B","accent":"#FFFFFF","hat":"headscarf","hatColor":"#FFFFFF","hair":"#8B5A2B"}],
  "es": [{"flag":"es","top":"#FFFFFF","bottom":"#1B1B1B","accent":"#D62828","hat":"beret","hatColor":"#1B1B1B","hair":"#2B1B12"},
         {"flag":"es","outfit":"dress","top":"#D62828","bottom":"#1B1B1B","accent":"#FFD6D6","hairStyle":"bun","hair":"#1B1B1B","hat":"flowerCrown"}],
}
COUNTRY = {"vn":"Viet Nam","jp":"Japan","kr":"Korea","fr":"France","es":"Spain"}
BG = {"vn":"#B9E4B4","jp":"#F9C6D6","kr":"#CFE3FF","fr":None,"es":None}
# (english, emoji-free sub, bg, image prompt, {country: (native script or None, romanized)})
EMO = {"Dog":"🐶","Cat":"🐱","Duck":"🦆","Rooster":"🐓"}
GUESS = {"Dog":"WOOF!","Cat":"MEOW!","Duck":"QUACK!","Rooster":"COCK-A-DOODLE-DOO!"}
ANIMALS = [
  ("Dog", "Woof woof!", "#FFE7B3", "A happy cartoon puppy, light brown with floppy ears, sitting and barking, full body",
   {"vn":(None,"Gâu gâu!"),"jp":("ワンワン","Wan wan!"),"kr":("멍멍","Meong meong!"),"fr":(None,"Ouaf ouaf!"),"es":(None,"¡Guau guau!")}),
  ("Cat", "Meow!", "#E6DBFF", "A cute cartoon orange kitten with big eyes, sitting and meowing, full body",
   {"vn":(None,"Meo meo!"),"jp":("ニャー","Nyaa!"),"kr":("야옹","Yaong!"),"fr":(None,"Miaou!"),"es":(None,"¡Miau!")}),
  ("Duck", "Quack quack!", "#C9F0FF", "A cute cartoon yellow duckling with orange beak, standing and quacking, full body",
   {"vn":(None,"Cạp cạp!"),"jp":("ガーガー","Gaa gaa!"),"kr":("꽥꽥","Kkwaek kkwaek!"),"fr":(None,"Coin-coin!"),"es":(None,"¡Cuac cuac!")}),
  ("Rooster", "Cock-a-doodle-doo!", "#FFD9C7", "A proud cartoon rooster with red comb and colorful tail, crowing, full body",
   {"vn":(None,"Ò ó o!"),"jp":("コケコッコー","Kokekokkō!"),"kr":("꼬끼오","Kkokkio!"),"fr":(None,"Cocorico!"),"es":(None,"¡Quiquiriquí!")}),
]

kid = lambda **k: {"look": {"top":"#4DB35E","bottom":"#6D4C41", **k}}
scenes = [{"type":"intro","duration":4,"title":"Meo with Pi","subtitle":"KIDS CHANNEL","handle":"@MeowPi"}]
mix = [kid(), kid(skin="#8D5A3B",hair="#1B1B1B",outfit="dress",top="#F26B21",bottom="#2F86C9",hairStyle="pigtails",accent="#FFFFFF"),
       kid(skin="#C68E68",hair="#1B1B1B",outfit="dress",top="#9B4FCB",bottom="#1D3557",hairStyle="bob",accent="#FFD6F0"),
       kid(top="#2F86C9",bottom="#F7C31B",hair="#F2C94C")]
globe = [{"look":l[0]} for l in LOOKS.values()] + [{"look":l[1]} for l in LOOKS.values()]
song = [  # 100% original lyrics, ≤7 words per line
  ("globe","left","outline",["Listen, listen, hear that sound?","Animals sing the whole world round!"], globe, []),
  ("meadow","bottom","outline",["The puppy barks, the kitty sings,","the duck goes splashing, flap your wings!"], mix[:2], ["🐶","🐱"]),
  ("sky","bottom","box",["Woof and meow, quack and crow,","every country says it so!"], mix[:2], ["🐶","🐱","🦆","🐓"]),
  ("sea","top","outline",["Little duck is swimming far,","paddle, paddle, there you are!"], mix[1:3], ["🦆"]),
  ("desert","bottom","outline",["Sun comes up, the rooster wakes,","what a big, big noise he makes!"], mix[2:], ["🐓"]),
  ("blocks","bottom","box",["Woof and meow, quack and crow,","every country says it so!"], mix[:2], ["🐶","🐱","🦆","🐓"]),
  ("globe","left","outline",["Let's fly around the world today,","and hear what all the animals say!"], globe, []),
]
for bg,pos,style,lines,chars,emo in song:
  scenes.append({"type":"lyric","duration":5.5,"background":{"kind":bg},"textPosition":pos,"textStyle":style,
                 "lines":[{"text":t} for t in lines],"characters":chars,"emojis":emo})
scenes.append({"type":"title","duration":4.5,"small":["Let's travel and listen!"],"big":"Animal Sounds Around the World",
               "say":"Hello everyone! Let's travel around the world and listen to the animals!"})
for ai,(name,sub,bg,prompt,sounds) in enumerate(ANIMALS):
  scenes.append({"type":"vocab","duration":6,"word":name.upper(),"sub":sub,"bg":bg,"side":"left" if ai%2==0 else "right",
                 "emoji":EMO[name],"guess":GUESS[name],"reveal":3,"imagePrompt":prompt,
                 "say":f"Who says {GUESS[name].lower()} ... It's a {name.lower()}! In English, the {name.lower()} says: {sub}"})
  for ci,(cc,(native,roman)) in enumerate(sounds.items()):
    s = {"type":"country","duration":4.5,"layout":"quad" if BG[cc] is None else "poster","country":COUNTRY[cc],"flag":cc,
         "greeting":roman,"romanization":roman,"characters":[{"look":l} for l in LOOKS[cc][: (2 if ci%2==0 or BG[cc] is None else 1)]],
         "pet":{"emoji":EMO[name]},"say":f"In {COUNTRY[cc]}, the {name.lower()} says: {roman}"}
    if native: s["native"] = native
    if BG[cc]: s["bg"] = BG[cc]
    scenes.append(s)
scenes.append({"type":"title","duration":5,"small":["Your turn!","What does the dog say"],"big":"in your language?",
               "say":"Now it's your turn! What does the dog say in your language? Tell us in the comments!"})
scenes.append({"type":"outro","duration":4.5,"text":"Woof! Meow! Quack! Bye-bye!","characters":mix[:3]})
scenes.append({"type":"subscribe","duration":4,"text":"SUBSCRIBE","sub":"OUR CHANNEL","handle":"@MeowPi"})

video = {
  "meta": {
    "title":"Animal Sounds Around the World | What Does the Dog Say? | Song for Kids",
    "description":"Woof, Gâu gâu, Wan wan, Meong meong! 🐶🐱🦆🐓 Did you know animals 'speak' differently in every country? Sing along and travel the world with Meo with Pi to hear how dogs, cats, ducks and roosters sound in Vietnam, Japan, Korea, France and Spain.\n\nWhat does the dog say in YOUR language? Tell us in the comments! 👇",
    "tags":["animal sounds","animal sounds in different languages","what does the dog say","animal song for kids","songs for kids","english for kids","nursery rhymes","tieng keu con vat","nhac thieu nhi","be hoc tieng anh","con vat cho be","dog sound","rooster sound"],
    "channel":"Meo with Pi","madeForKids":True},
  "audio":{"bgm":"demo/bgm.mp3","bgmVolume":0.45},
  "scenes":scenes,
}
json.dump(video, open("content/animal-sounds-around-the-world.json","w",encoding="utf8"), ensure_ascii=False, indent=2)
print(len(scenes), "scenes,", sum(s["duration"] for s in scenes), "s")
