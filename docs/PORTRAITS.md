# Portrait brief

The game draws its 60 suspects in code (`web/src/portraits/portrait.ts`, the "sketch" look). This brief is
for replacing those drawings with real pictures later: drawn by hand, commissioned, or made with an image
generator, in one consistent style. Hand the finished files to an agent; wiring them in is a small change, and
the drawn portraits stay as the fallback.

## Rules
- **Our own suspects only.** Draw the people in the table below. Don't copy, trace or imitate the
  characters, cards or art of any existing game. Don't give another game's card images to an artist or an
  image generator as a reference.
- **Rights.** The owner must be able to publish every image: your own drawings, an artist's work with a
  written licence or transfer, or a generator whose terms allow commercial use. Note where each one came from.
- **No text in the picture.** The game adds the card, the name and the file number.

## Style
- **Ink and wash.** Black ink lines with grey wash shading on cream paper. No colour.
- **Head and shoulders,** the head turned about three-quarters, both eyes visible.
- **Faces with character.** A smirk, a scowl, a raised brow, tired eyes: vary them, and let the job show in
  the face as well as the clothes.
- **One light.** Light from one side, with the shading soft and gathered on the far cheek and under the
  chin and hat brim.
- **Period.** A 1940s–50s city: hats, coats, uniforms and props that fit each job.
- **Readable small.** On a phone a card is about 90 px wide. Each suspect needs a clear silhouette (hat,
  hair) and at most one prop.

## Files
- **Size:** 800 × 1000 px (4:5), WebP, at most 60 KB each.
- **Framing:** the same for all 60, so the board looks even. Top of the head about 15% from the top edge,
  chin at about 55%, face centred.
- **Background:** plain cream paper, no frame.
- **Names:** the suspect's id, so `0.webp` is Ada and `59.webp` is Mort.

## The suspects
The table follows `shared/roster.json`, which is the source of truth if they ever differ.

| Id | Name | Gender | Age | Job |
|---|---|---|---|---|
| 0 | Ada | woman | young | switchboard operator |
| 1 | Abe | man | older | bookie |
| 2 | Beatrice | woman | young | heiress |
| 3 | Bruno | man | adult | enforcer |
| 4 | Cora | woman | adult | nightclub singer |
| 5 | Calvin | man | young | bellhop |
| 6 | Dorothy | woman | young | typist |
| 7 | Duke | man | adult | boxer |
| 8 | Edith | woman | older | landlady |
| 9 | Elmer | man | older | mailman |
| 10 | Frances | woman | adult | reporter |
| 11 | Floyd | man | adult | bootlegger |
| 12 | Gloria | woman | young | film starlet |
| 13 | Gus | man | adult | dockworker |
| 14 | Hazel | woman | adult | nurse |
| 15 | Hank | man | older | night watchman |
| 16 | Imogen | woman | older | fortune teller |
| 17 | Ike | man | young | shoeshine |
| 18 | Josephine | woman | adult | jazz pianist |
| 19 | Jasper | man | older | butler |
| 20 | Lillian | woman | young | cigarette girl |
| 21 | Leon | man | adult | trumpet player |
| 22 | Mabel | woman | adult | diner waitress |
| 23 | Milo | man | young | newsboy |
| 24 | Nora | woman | adult | private secretary |
| 25 | Nico | man | adult | chef |
| 26 | Opal | woman | older | pawnbroker |
| 27 | Otto | man | older | locksmith |
| 28 | Pearl | woman | adult | socialite |
| 29 | Percy | man | adult | accountant |
| 30 | Rosalind | woman | adult | lawyer |
| 31 | Quincy | man | older | banker |
| 32 | Sylvia | woman | young | photographer |
| 33 | Rex | man | adult | gangster |
| 34 | Theodora | woman | older | widow |
| 35 | Sal | man | older | barber |
| 36 | Una | woman | adult | librarian |
| 37 | Thaddeus | man | older | professor |
| 38 | Vera | woman | adult | femme fatale |
| 39 | Vic | man | adult | loan shark |
| 40 | Winifred | woman | older | schoolteacher |
| 41 | Walter | man | older | doorman |
| 42 | Agnes | woman | older | florist |
| 43 | Archie | man | young | mechanic |
| 44 | Bernadette | woman | adult | seamstress |
| 45 | Barney | man | adult | milkman |
| 46 | Clara | woman | young | telegraph clerk |
| 47 | Cyrus | man | adult | stage magician |
| 48 | Delphine | woman | young | dancer |
| 49 | Dexter | man | adult | con artist |
| 50 | Esther | woman | older | bookkeeper |
| 51 | Emmett | man | older | preacher |
| 52 | Greta | woman | adult | bartender |
| 53 | Fitz | man | older | alderman |
| 54 | Harriet | woman | adult | aviator |
| 55 | Gordon | man | adult | surgeon |
| 56 | Louisa | woman | young | hat check girl |
| 57 | Lloyd | man | adult | chauffeur |
| 58 | Maxine | woman | adult | cab driver |
| 59 | Mort | man | older | mortician |
