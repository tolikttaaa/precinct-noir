# Picture portraits

The suspects' faces are meant to be pictures: hand-drawn noir graphic-novel portraits in black ink on
sepia parchment. Until a suspect has a picture, the game draws one (`web/src/portraits/portrait.ts`).

## How it works
- Put each picture in `web/src/portraits/images/`, named by the suspect's id: `0.webp` is Ada, `59.webp`
  is Mort. WebP, JPEG (`.jpg`) or PNG all work.
- The build picks them up on its own. A suspect with a picture shows it on every card and on the
  evidence wall; the rest keep their drawn portrait, so pictures can arrive a few at a time.
- Or hand the files to an agent: it renames, crops and shrinks them to the format below.

## Rules
- **Our own suspects only.** Make the people described below. Don't copy, trace or imitate the
  characters, cards or art of an existing game, and don't give another game's card images to an artist
  or an image generator as a reference.
- **Rights.** The owner must be able to publish every picture: your own drawings, an artist's work with
  a written licence, or a generator whose terms allow commercial use. Note where each one came from.
- **No text in the picture.** The game adds the card, the name and the file number.

## The style
- **Ink:** black brush ink with varied line weight. Shadows are bold solid black (hair, suits, the shadow
  side of the face), with fine hatching on the face.
- **Paper:** aged, tea-stained parchment, with a soft sepia glow behind the figure. The drawing fades out
  loosely toward the bottom. No colour but black and sepia.
- **Framing:** a tight bust, the face large in the upper half, three-quarter view or profile. A hand may
  come into the frame (on a collar, a lapel, the chin).
- **Faces with character:** strong, slightly exaggerated expressions: a grin, a scowl, a smug smirk,
  wide eyes. Every suspect should look like someone with a story.

## Making them with an image generator
1. Use a square format (1:1, for example 1024 × 1024).
2. Paste a suspect's prompt from the list below. Each one starts with the same style text, so the set
   matches.
3. When the first few look right, pick the best one and give **that picture of yours** to the generator
   as its style reference for the rest (most generators can). That keeps 60 pictures looking like one
   artist drew them.
4. Redo a picture if the face is small, if there's text, a frame or a second person, or if it has colour
   other than sepia.

## Files
- **Format:** square, at least 512 × 512. They're stored as 512 × 512 WebP, about 40 KB each.
- **Framing:** head and shoulders, the face large and in the upper part of the square; cards show the
  whole square, and the wall crops a little off the sides.
- **Background:** plain cream paper, no frame.

## The prompts
One per suspect, ready to paste. Each describes the suspect's job, age, look and props, which match the
drawn portrait players already know (`KITS` in `portrait.ts`), plus an expression and sometimes a pose.

### 0. Ada
Save as `0.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a switchboard operator in a 1940s American city. She has finger-waved dark hair. She wears a telephone headset, a blouse and drop earrings. Her face: a warm, easy smile.
```

### 1. Abe
Save as `1.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set elderly man, a bookie in a 1940s American city. He has a walrus moustache. He wears a fedora and a suit and tie. A cigar clamped in the teeth. His face: cool and unreadable, giving nothing away. One hand straightens the collar.
```

### 2. Beatrice
Save as `2.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, an heiress in a 1940s American city. She has a sleek fair bob. She wears a fur stole, a pearl necklace and drop earrings. Her face: a smug, knowing smirk, one eyebrow arched. A hand is raised to the chin.
```

### 3. Bruno
Save as `3.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set middle-aged man, an enforcer in a 1940s American city. He has a scar on the cheek. He wears a fedora pulled low over the brow and a dark suit. His face: a deep scowl, the brows knotted. Glancing back over the shoulder at the viewer.
```

### 4. Cora
Save as `4.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a nightclub singer in a 1940s American city. She has long dark hair. She wears an evening gown, a flower in the hair and drop earrings. Her face: a sly half-smile, the eyes sliding sideways. Leaning slightly toward the viewer.
```

### 5. Calvin
Save as `5.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean young man, a bellhop in a 1940s American city. He has freckles. He wears a pillbox cap with a chin strap and a buttoned uniform. His face: a warm, easy smile. One hand grips a lapel.
```

### 6. Dorothy
Save as `6.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a typist in a 1940s American city. She has dark hair pulled into a bun. She wears a blouse with a bow at the collar, cat-eye glasses and a pencil behind the ear. Her face: cool and unreadable, giving nothing away.
```

### 7. Duke
Save as `7.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set middle-aged man, a boxer in a 1940s American city. He has close-cropped dark hair and a bandage across the nose. He wears a towel around the neck. His face: a hard, unblinking stare and a clenched jaw.
```

### 8. Edith
Save as `8.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a landlady in a 1940s American city. She has curly grey hair. She wears a headscarf, a cardigan and half-moon reading glasses. Her face: a sour, tired frown. One hand straightens the collar.
```

### 9. Elmer
Save as `9.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a mailman in a 1940s American city. He has a walrus moustache. He wears a peaked cap, a buttoned uniform and a satchel strap across the chest. His face: cool and unreadable, giving nothing away. A hand is raised to the chin.
```

### 10. Frances
Save as `10.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a reporter in a 1940s American city. She wears a fedora tilted to one side, a suit and tie, a press card tucked in the hatband and a pencil behind the ear. Her face: a sly half-smile, the eyes sliding sideways. Glancing back over the shoulder at the viewer.
```

### 11. Floyd
Save as `11.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a bootlegger in a 1940s American city. He has heavy stubble. He wears a flat cap and a waistcoat over shirtsleeves. A toothpick in the mouth. His face: a sly half-smile, the eyes sliding sideways. Leaning slightly toward the viewer.
```

### 12. Gloria
Save as `12.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a film starlet in a 1940s American city. She has long fair hair and a beauty mark. She wears a fur stole and drop earrings. Her face: a sceptical look, one eyebrow arched high. One hand grips a lapel.
```

### 13. Gus
Save as `13.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set middle-aged man, a dockworker in a 1940s American city. He has a full beard. He wears a knitted watch cap and a heavy peacoat. His face: a hard, unblinking stare and a clenched jaw.
```

### 14. Hazel
Save as `14.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a nurse in a 1940s American city. She has dark hair in victory rolls. She wears a nurse's cap, a white jacket and a stethoscope. Her face: a warm, easy smile.
```

### 15. Hank
Save as `15.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a night watchman in a 1940s American city. He has a walrus moustache. He wears a peaked cap with a badge and a heavy peacoat. His face: a hard, unblinking stare and a clenched jaw. One hand straightens the collar.
```

### 16. Imogen
Save as `16.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a fortune teller in a 1940s American city. She wears a turban, a shawl, hoop earrings and a bead necklace. Her face: a smug, knowing smirk, one eyebrow arched. A hand is raised to the chin.
```

### 17. Ike
Save as `17.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean young man, a shoeshine in a 1940s American city. He has freckles. He wears a newsboy cap, a waistcoat over shirtsleeves and a cloth over one shoulder. His face: a warm, easy smile. Glancing back over the shoulder at the viewer.
```

### 18. Josephine
Save as `18.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a jazz pianist in a 1940s American city. She has curly dark hair. She wears a plain dress and long strands of pearls. A long cigarette holder in hand. Her face: a sly half-smile, the eyes sliding sideways. Leaning slightly toward the viewer.
```

### 19. Jasper
Save as `19.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a butler in a 1940s American city. He has a balding head with grey hair at the sides and mutton-chop sideburns. He wears a tailcoat. His face: a sceptical look, one eyebrow arched high. One hand grips a lapel.
```

### 20. Lillian
Save as `20.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a cigarette girl in a 1940s American city. She has curly dark hair and a beauty mark. She wears a small pillbox hat, a plain dress and a strap over the shoulder. Her face: a warm, easy smile.
```

### 21. Leon
Save as `21.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a trumpet player in a 1940s American city. He has a dark pompadour and a pencil moustache. He wears a suit with a bow tie. His face: a sly half-smile, the eyes sliding sideways.
```

### 22. Mabel
Save as `22.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a diner waitress in a 1940s American city. She has a dark ponytail. She wears a folded paper cap, a blouse, a name tag and a pencil behind the ear. Her face: a warm, easy smile. One hand straightens the collar.
```

### 23. Milo
Save as `23.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean young man, a newsboy in a 1940s American city. He has freckles. He wears a newsboy cap, a waistcoat over shirtsleeves and a satchel strap across the chest. His face: a warm, easy smile. A hand is raised to the chin.
```

### 24. Nora
Save as `24.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a private secretary in a 1940s American city. She has dark hair in victory rolls. She wears a suit and tie, horn-rimmed glasses and drop earrings. Her face: cool and unreadable, giving nothing away. Glancing back over the shoulder at the viewer.
```

### 25. Nico
Save as `25.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set middle-aged man, a chef in a 1940s American city. He has a handlebar moustache. He wears a tall chef's toque, a chef's jacket and a neckerchief. His face: a warm, easy smile. Leaning slightly toward the viewer.
```

### 26. Opal
Save as `26.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a pawnbroker in a 1940s American city. She has grey hair pulled into a bun. She wears a shawl and hoop earrings. A jeweller's loupe in one eye. Her face: a sceptical look, one eyebrow arched high. One hand grips a lapel.
```

### 27. Otto
Save as `27.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a locksmith in a 1940s American city. He has a full beard. He wears a flat cap, an apron over a work shirt, round glasses and a ring of keys. His face: cool and unreadable, giving nothing away.
```

### 28. Pearl
Save as `28.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a socialite in a 1940s American city. She wears a wide-brimmed hat with a feather, a fur stole and a pearl necklace. A long cigarette holder in hand. Her face: a smug, knowing smirk, one eyebrow arched.
```

### 29. Percy
Save as `29.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean middle-aged man, an accountant in a 1940s American city. He has neatly side-parted dark hair. He wears a visor eyeshade, a waistcoat over shirtsleeves and round glasses. His face: a sceptical look, one eyebrow arched high. One hand straightens the collar.
```

### 30. Rosalind
Save as `30.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a lawyer in a 1940s American city. She has an elegant dark chignon. She wears a suit and tie and horn-rimmed glasses. Her face: a hard, unblinking stare and a clenched jaw. A hand is raised to the chin.
```

### 31. Quincy
Save as `31.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set elderly man, a banker in a 1940s American city. He has mutton-chop sideburns. He wears a homburg, a suit and tie, a monocle and a watch chain. His face: cool and unreadable, giving nothing away. Glancing back over the shoulder at the viewer.
```

### 32. Sylvia
Save as `32.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a photographer in a 1940s American city. She has a sleek dark bob. She wears a beret, a turtleneck sweater and a camera on a strap. Her face: a sly half-smile, the eyes sliding sideways. Leaning slightly toward the viewer.
```

### 33. Rex
Save as `33.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a gangster in a 1940s American city. He wears a fedora with a wide band, a dark suit and a flower in the lapel. A cigarette between the lips. His face: a cold smirk under narrowed eyes. One hand grips a lapel.
```

### 34. Theodora
Save as `34.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a widow in a 1940s American city. She has an elegant grey chignon. She wears a small hat with a net veil, a plain dress and a pearl necklace. Her face: a sour, tired frown.
```

### 35. Sal
Save as `35.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a barber in a 1940s American city. He has slicked-back grey hair and a handlebar moustache. He wears a white jacket, a comb in the breast pocket and a bow tie. His face: a warm, easy smile.
```

### 36. Una
Save as `36.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a librarian in a 1940s American city. She has dark hair pulled into a bun. She wears a cardigan, cat-eye glasses and a pencil behind the ear. Her face: a sceptical look, one eyebrow arched high. One hand straightens the collar.
```

### 37. Thaddeus
Save as `37.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a professor in a 1940s American city. He has wild, untamed grey hair and a goatee. He wears a suit with a bow tie and round glasses. A pipe in the mouth. His face: a sceptical look, one eyebrow arched high. A hand is raised to the chin.
```

### 38. Vera
Save as `38.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a femme fatale in a 1940s American city. She has long dark hair falling over one eye. She wears an evening gown and drop earrings. A cigarette between the lips. Her face: a smug, knowing smirk, one eyebrow arched. Glancing back over the shoulder at the viewer.
```

### 39. Vic
Save as `39.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a loan shark in a 1940s American city. He has a pencil moustache. He wears a fedora and a suit and tie. A toothpick in the mouth. His face: a cold smirk under narrowed eyes. Leaning slightly toward the viewer.
```

### 40. Winifred
Save as `40.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a schoolteacher in a 1940s American city. She has grey hair pulled into a bun. She wears a blouse with a bow at the collar and half-moon reading glasses. Her face: a hard, unblinking stare and a clenched jaw. One hand grips a lapel.
```

### 41. Walter
Save as `41.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set elderly man, a doorman in a 1940s American city. He has mutton-chop sideburns. He wears a peaked cap with braid on the brim and a uniform with epaulettes. His face: cool and unreadable, giving nothing away.
```

### 42. Agnes
Save as `42.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a florist in a 1940s American city. She has curly grey hair. She wears a headscarf, an apron over a work shirt and a flower in the hair. Her face: a warm, easy smile.
```

### 43. Archie
Save as `43.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean young man, a mechanic in a 1940s American city. He has messy dark hair and a smudge of grease on the cheek. He wears work coveralls and a cloth over one shoulder. His face: a sly half-smile, the eyes sliding sideways. One hand straightens the collar.
```

### 44. Bernadette
Save as `44.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a seamstress in a 1940s American city. She has dark hair pulled into a bun. She wears a blouse and a tape measure around the neck. Her face: cool and unreadable, giving nothing away. A hand is raised to the chin.
```

### 45. Barney
Save as `45.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a milkman in a 1940s American city. He wears a white peaked cap, a white jacket and a bow tie. His face: a warm, easy smile. Glancing back over the shoulder at the viewer.
```

### 46. Clara
Save as `46.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a telegraph clerk in a 1940s American city. She has a sleek dark bob. She wears a visor eyeshade, a waistcoat over shirtsleeves and a pencil behind the ear. Her face: cool and unreadable, giving nothing away. Leaning slightly toward the viewer.
```

### 47. Cyrus
Save as `47.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a stage magician in a 1940s American city. He has a goatee. He wears a top hat, a suit with a bow tie and a scarf. His face: a smug, knowing smirk, one eyebrow arched. One hand grips a lapel.
```

### 48. Delphine
Save as `48.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a dancer in a 1940s American city. She has a sleek dark bob. She wears a headband with a feather, a plain dress and long strands of pearls. Her face: a warm, easy smile.
```

### 49. Dexter
Save as `49.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a con artist in a 1940s American city. He has a pencil moustache. He wears a straw boater and a suit with a bow tie. His face: a warm, easy smile.
```

### 50. Esther
Save as `50.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly woman, a bookkeeper in a 1940s American city. She has grey hair pulled into a bun. She wears a cardigan, half-moon reading glasses and a pearl necklace. Her face: cool and unreadable, giving nothing away. One hand straightens the collar.
```

### 51. Emmett
Save as `51.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. An elderly man, a preacher in a 1940s American city. He has a full beard. He wears a wide flat-brimmed hat and a clerical collar. His face: a hard, unblinking stare and a clenched jaw. A hand is raised to the chin.
```

### 52. Greta
Save as `52.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a bartender in a 1940s American city. She has a dark ponytail. She wears a waistcoat over shirtsleeves, a bow tie and a cloth over one shoulder. Her face: a sly half-smile, the eyes sliding sideways. Glancing back over the shoulder at the viewer.
```

### 53. Fitz
Save as `53.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A heavy-set elderly man, an alderman in a 1940s American city. He has a walrus moustache. He wears a bowler hat, a suit and tie and a rosette on the lapel. A cigar clamped in the teeth. His face: cool and unreadable, giving nothing away. Leaning slightly toward the viewer.
```

### 54. Harriet
Save as `54.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, an aviator in a 1940s American city. She wears a leather flying helmet, a leather jacket, goggles pushed up on the head and a scarf. Her face: a sly half-smile, the eyes sliding sideways. One hand grips a lapel.
```

### 55. Gordon
Save as `55.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a surgeon in a 1940s American city. He wears a surgical cap, a white jacket, a surgical mask pulled down under the chin and round glasses. His face: a hard, unblinking stare and a clenched jaw.
```

### 56. Louisa
Save as `56.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A young woman, a hat check girl in a 1940s American city. She has curly fair hair. She wears a buttoned uniform, a bow in the hair and a name tag. Her face: a warm, easy smile.
```

### 57. Lloyd
Save as `57.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged man, a chauffeur in a 1940s American city. He has a pencil moustache. He wears a peaked cap and a uniform with epaulettes. His face: cool and unreadable, giving nothing away. One hand straightens the collar.
```

### 58. Maxine
Save as `58.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A middle-aged woman, a cab driver in a 1940s American city. She wears a newsboy cap, a leather jacket and a name tag. Her face: a sly half-smile, the eyes sliding sideways. A hand is raised to the chin.
```

### 59. Mort
Save as `59.webp`.

```text
Hand-drawn character portrait in the style of a 1940s noir graphic novel. Black brush-ink line art with varied line weight, bold solid-black shadows on the hair, the clothes and the shadow side of the face, and fine hatching on the face. Aged, tea-stained parchment background with a soft sepia airbrushed glow behind the figure; the drawing fades out loosely toward the bottom. Tight head-and-shoulders bust, the face large in the upper half of a square frame, three-quarter view or profile. Expressive, slightly exaggerated features with a strong personality. Only black ink on sepia paper, no other colour, no text, no frame, no border. A lean elderly man, a mortician in a 1940s American city. He has slicked-back grey hair. He wears a dark suit. His face: a sceptical look, one eyebrow arched high. Glancing back over the shoulder at the viewer.
```
