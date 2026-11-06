# Precinct Noir — Rules

This document is both the player rules and the **engine specification**. Where the rules
needed a precise decision, the decision has an ID (e.g. `KI-2`). Each ID is pinned by an
engine test, so changing a decision is always deliberate. Lobby **variant switches** are
listed at the end.

Precinct Noir is an independent project; its mechanics are inspired by the card game *Noir*
(Level 99 Games). All wording here is original.

---

## 1. Common concepts

### 1.1 The city
- **Board ("the city").** A square grid of **suspects**: 5×5, 6×6 or 7×7 depending on the case.
  Each game draws the suspects at random from the [roster](../shared/roster.json).
- **Evidence deck.** One face-down card per suspect on the board, shuffled. Only the server
  knows its order. Card counts are public.
- **Identity.** Most players secretly *are* one suspect: the card they hold face-down.
  Moving that suspect around the city moves you.
- **Hand.** Some roles keep extra evidence cards in a private hand.
- **Discard pile.** Face-up and visible to everyone.

### 1.2 Suspect state
Each suspect is **alive** or **dead**, and may carry:
- **Markers:**
  - *Exonerated*: a face-up evidence card. This suspect is not the hidden player it was checked against.
  - *Arrested*: Feds vs. Mob only.
  - *Officer* (uniformed, possibly *stunned*): Cat Burglar and Casino Heist.
- **Tokens:** treasure, protection, threat or bomb. A suspect holds at most one token of each kind.

Markers and tokens belong to the suspect and travel with it when the city moves.

**Killing** a suspect makes it dead, removes all its tokens (an unexploded bomb on a victim
does *not* go off) and removes an officer marker. An exoneration marker stays on the body.

### 1.3 Neighbours and ranges
- **Neighbours of X, `N(X)`:** the up to 8 suspects touching X orthogonally or diagonally.
  They never wrap around the edge: a corner suspect has 3 neighbours, an edge suspect 5,
  an inner suspect 8. X is *not* its own neighbour.
- **`N[X]`:** X together with its neighbours. Used when a rule says "including yourself".
- **Straight line within 3:** suspects 1–3 cells away in the same row or column, no wrap.
- **Diagonal within 3:** suspects 1–3 cells away on the two diagonals, no wrap.

### 1.4 Turns
On your turn you take exactly **one action**. You can't pass, and a shift is always
available, so you always have a legal move. The server offers only legal actions.

### 1.5 Shift
- Pick **any** row or column (you don't need to be in it) and slide it one cell
  (certain roles may slide two). The suspect pushed off the edge reappears at the other end.
- **No instant undo:** you may not make the shift that exactly reverses the shift made by
  the **previous action**. Once anyone takes another action, the old shift may be reversed again.
  - The test is modular. On a line of length 4, +2 followed by +2 counts as an undo.
  - Sub-steps, start-of-turn effects, reactions and free actions do not reset this.

### 1.6 Collapse
Instead of shifting, a player may collapse the city when **every column** (or **every row**)
contains at least one dead suspect:
1. Choose the direction that qualifies.
2. In each column (or row), choose **one** dead suspect to remove.
   - If a line has several dead suspects, the acting player picks which one goes; the others stay.
   - Arrested suspects are alive and never removed.
3. Removed suspects leave the game, and the city closes the gaps and shrinks by one row (or column).
4. If the smaller city qualifies again, the same player may collapse again in the same action,
   or stop.

Evidence for a removed suspect still sitting in the deck or a hand stays there, but from now
on it counts as "not alive". An exoneration card on a removed suspect leaves play.

### 1.7 Questioning
Many actions ask hidden players whether they are next to a suspect, or ask them to
"raise a hand". **The server answers automatically and truthfully.** The answer is
announced on the TV and in the case log.

### 1.8 Information
- Public: the city, markers, tokens, discards, card counts, roles where a case says so, scores.
- Private: identities, hands, the deck order, private draws.
- Teams see what their case allows (see each case).
- When the game ends, everything is revealed.

---

## 2. Shadow Duel *(2 players, 5×5)*
A **Killer** hides in the crowd; an **Inspector** hunts them. Each is also the other's prey.

**Setup**
- Roles are random. In a rematch ("Play again") the two players swap roles.
- The Killer secretly draws 1 evidence card: their identity.
- The Inspector starts with nothing.

**First round**
1. **Killer, turn 1:** must **Kill** (see below).
2. **Inspector, turn 1:** draws 4 cards and secretly picks one **living** suspect among them
   as their identity (`KI-3`: the suspect just killed can't be picked). The other 3 form their
   hand. This is their whole turn.

After that the players alternate.

**Killer actions**
- **Shift / Collapse.**
- **Kill:** a living suspect in `N(Killer)` dies.
  - If it was the Inspector's identity, the Killer wins.
  - If the victim carried an *Exonerated* marker, the server announces whether the Inspector
    is next to the victim (`KI-7`: this applies even when the victim was the Killer's own old disguise).
- **Disguise:** secretly draw the top card.
  - If that suspect is alive on the board, the Killer's current identity is publicly marked
    *Exonerated* and the drawn card becomes the new identity.
  - Otherwise the drawn card is discarded face-up and nothing else changes.
  - Either way, the turn ends.

**Inspector actions**
- **Shift / Collapse.**
- **Accuse:** name a living suspect in `N[Inspector]`; accusing yourself is a legal bluff.
  If it is the Killer, the Inspector wins. Otherwise everyone hears "not the killer".
- **Exonerate:**
  1. Draw 1 card (hand of 4) and discard one of the four face-up.
  2. If that suspect is alive, mark it *Exonerated*.
  3. If the suspect is still on the board, the server announces whether the Killer is next to it.
     - `KI-2`: this also applies when the suspect is dead but still on the board.
     - It does not apply when the suspect was removed by a collapse.
  4. The hand is back to 3.

**Winning**
- The Killer wins by killing the Inspector's identity, or by reaching **14 kills**
  (`KI-6`: the turn-1 kill counts).
- The Inspector wins by accusing the Killer.

**Edge cases**
- `KI-1`: with an empty deck, Disguise and Exonerate are unavailable.
- `KI-4`: Kill and Accuse target living suspects only.
- `KI-5`: a suspect removed by collapse counts as dead everywhere.
- `KI-8`: an exoneration card on a removed suspect leaves play.

---

## 3. Spy Ring *(3–6, 8 or 9 players)*
Everyone is a **spy**. Catch rival spies to collect trophies.

**Setup**
- City size: 5×5 for 3–4 players, 6×6 for 5–6, 7×7 for 8–9.
- Each spy secretly draws 1 identity. A random player starts, then play follows seat order.
- **Free-for-all** with 3–5 players.
- **Agencies (teams)** with 6 or 8 players (teams of 2) and with 9 players (teams of 3).
  Turn order alternates between agencies.
- By default agents do **not** see their partners' identities (variant `teamsShareIdentities`).
- All table talk must be audible to everyone, so there is no private team chat.

**Goal: trophies**
| Players | Trophies to win |
|---|---|
| 3 | 4 |
| 4–5 | 3 |
| 6 or 8 (teams of 2) | 3 per agency |
| 9 (teams of 3) | 4 per agency |

**Actions**
- **Shift / Collapse.**
- **Catch:** choose a living suspect in `N(you)`.
  - If a **rival** spy has that identity: the suspect dies, you (or your agency) take the card
    as a trophy, and the caught spy immediately draws a new identity in secret, redrawing
    past dead suspects.
  - Otherwise everyone just hears "nobody". `SP-2`: a partner is never caught; the result looks
    exactly like a miss, and your menu never hides partner tiles.
- **Interrogate:** choose any suspect T in `N[you]`; yourself is allowed. The server lists every
  player whose identity is in `N[T]`, which always includes you.

**Edge cases**
- `SP-1`: 7 players is not supported (variant `sevenPlayers`: free-for-all on 7×7, 3 trophies).
- `SP-3`: you can't Catch yourself.
- `SP-6`: variant `forceFreeForAll` for 6+ players (3 trophies).

---

## 4. The Hit List *(2 players, 5×5)*
A **Hitman** works through a secret list; a **Sleuth** tries to unmask them.

**Setup**
- Hitman:
  - Deal 4 cards face-down as the **hit list**.
  - Draw 1 card as identity.
  - Reveal the first list card publicly: that's the current target.
- Sleuth: draw 3 cards, pick one as identity. The other 2 form the hand.
- The Hitman moves first.

**Hitman actions**
- **Shift / Collapse.**
- **Kill:** a living suspect in `N(Hitman)` dies. Then, in this order (`HS-5`):
  1. If the victim's card is in the Sleuth's hand, it is discarded face-up, with no replacement.
  2. If the victim was the current target, discard it and reveal the next list card.
     Keep revealing past suspects that are already dead (`HS-2`).
     If the list runs out, **the Hitman wins**.
  3. If the victim was the Sleuth's identity, the Sleuth must pick a new identity from their
     hand. With an empty hand, **the Hitman wins**.
  4. There is no questioning on kills in this case.
- **Escape** (needs ≥ 2 cards in the deck): a Disguise (as in Shadow Duel). If it succeeds,
  the deck's top card is added face-down to the end of the hit list. `HS-3`: a failed escape adds nothing.

**Sleuth actions**
- **Shift / Collapse.**
- **Expose:** name a living suspect in `N[Sleuth]`. If it is the Hitman, the Sleuth wins.
  Otherwise one face-down hit-list card, if any, goes to the bottom of the deck.
  `HS-1`: nobody may look at face-down list cards, so the last one is returned automatically
  (variant `hitListVisibleToHitman` lets the Hitman see them and choose).
- **Exonerate:**
  1. Draw 1 card if the deck isn't empty.
  2. Place one hand card on its suspect as *Exonerated*.
  3. The server announces whether the Hitman is next to it.
  4. This is allowed even with an empty deck, as long as the hand isn't empty.

**Edge cases**
- `HS-6`: hand cards are never of dead suspects, because they're discarded when the suspect dies.
- `HS-7`: placing follows the same rule as `KI-2`.

---

## 5. Cat Burglar *(2 players, 5×5)*
A **Master Thief** robs the whole city; the **Police Chief** works through plainclothes and
uniformed officers.

**Setup**
- Put a **treasure** token on all 25 suspects. Nobody dies in this case, so there is no collapse.
- Thief: draw 3 cards and pick one as the **active identity**. The other 2 stay in hand for later disguises.
- Chief: draw 1 card as the secret **plainclothes officer**, then 2 cards as **uniformed officers**,
  marked publicly on the board.
  - `MT-1`: the first card drawn is the plainclothes officer.
  - Variant `chiefChoosesOfficers` lets the Chief draw 3 and assign them.
- The Thief moves first.

**Thief actions**
- **Shift.**
- **Steal:** take the treasure from your active identity or a neighbour (`N[active]`).
  **25 treasures win.**
- **Quick disguise:** return the active identity to hand and set any hand card as the new
  active identity. Re-picking the same card is allowed, and it looks identical to everyone.

**Chief actions**
- **Shift.**
- **Accuse:** any suspect next to the plainclothes officer or next to a uniformed officer,
  including those officers themselves. The Chief doesn't reveal which officer made the arrest.
  - If it is the Thief's **active** identity, the Chief wins.
  - `MT-2`: cards in the Thief's hand are safe.
- **Swear in** (deck not empty):
  1. Draw a card; it becomes a new uniformed officer.
  2. Dismiss one uniformed officer to the discard pile; it may be the new one.
  3. Then the Thief immediately takes **any one** treasure from anywhere.
     `MT-3`: this free grab is not a turn and doesn't reset the shift-undo rule.

**Match play:** optionally play two games with swapped roles; whoever stole more treasure wins.

---

## 6. Feds vs. Mob *(6 or 8 players)*
Two teams with unique, public roles. Teammates see each other's identities, and the team
sees each new identity whenever it changes.

**Setup**
- 6 players on 6×6 (teams of 3); 8 players on 7×7 (teams of 4).
- **Feds:** Undercover Agent, Detective, Operative, plus a Forensic Analyst with 8 players.
- **Mob:** Killer, Maniac, Bomber, plus a Sniper with 8 players.
- Everyone draws 1 identity. Then the Forensic Analyst draws a hand of 4.
- Turns alternate Mob, Feds, Mob, Feds… The Mob's Killer goes first.

**Goals**
- Feds: make 4 arrests (6 players) or 5 (8 players). Variant `fedsNeedOneMore` adds +1.
- Mob: reach 18 kills (6 players) or 25 (8 players).
- The first team to reach its goal wins.

**Kills and arrests**
- **Killing an innocent suspect:** +1 kill for the Mob.
- **Killing a Fed's identity:** +2 kills for the Mob (`FM-1`: the body and the trophy card).
  The Fed draws a new identity.
- **The Mob killing one of its own:** `FM-2`: counts as an **arrest** for the Feds, not a kill.
  That mobster's tokens are cleaned up after the current effect finishes, then they draw a new identity.
- **Correctly accusing a mobster = arrest:**
  1. The suspect gets an *Arrested* marker. `FM-3`: it stays alive, can't be killed and is never collapsed.
  2. The Feds score.
  3. Tokens tied to that mobster are removed: all bombs if it was the Bomber, all threats if it was the Maniac.
  4. The mobster draws a new identity.
- `FM-13`: if a forced redraw finds the deck empty, living face-up discards are shuffled back in.
  If that still yields nothing, the player plays on without an identity (shift, collapse and
  token actions only).

**Any Fed, in addition to their role actions**
- **Defuse:** remove a bomb or threat token from a suspect in `N(you)`.
  `FM-14`: not from your own suspect; an arrested suspect is fine.

**Undercover Agent**
- Shift / Collapse; Accuse in `N[you]`.
- **Disguise:** peek at the top card.
  - If that suspect is alive, discard your old identity face-up and take the new one.
  - Otherwise put the card on the bottom of the deck, privately.
- **Autopsy:** choose a dead suspect in `N(you)`. Every mobster whose identity is next to it is
  announced.

**Detective**
- Shift / Collapse.
- **Long-range accuse:** yourself or any living suspect in a straight line within 3.
- **Interrogate:**
  1. Draw 2 cards, put one on the bottom of the deck (private), and place the other as *Exonerated*.
  2. Every player, of either team, whose identity is next to it is announced.
  3. `FM-11`: with 1 card left, draw and place it.

**Operative**
- **Start of turn (mandatory, `FM-8`):** place one protection token on a living suspect, or
  remove one. At most 6 protection tokens may be in play.
- Shift 1–2 cells / Collapse; Accuse in `N[you]`.
- **Protect (reaction, any time):** when a suspect with a protection token in your row or column
  would die, you may save it. Not yourself.
  - Saving it cancels that death and the rest of that effect, so a bomb chain stops there.
  - `FM-6`: the token stays (variant `protectionConsumedOnUse`).
  - A protection prompt appears for **every** lethal hit on a protected suspect, so the prompt
    itself never reveals where the Operative is.

**Forensic Analyst** (8 players)
- Shift / Collapse; Accuse in `N[you]`.
- **Collect evidence:**
  1. Place one hand card on its living suspect as *Exonerated*.
  2. Discard hand cards of dead suspects and refill to 4.
  3. Every mobster next to the placed suspect is announced.
  4. `FM-12`: if no card can be placed, you may still discard dead cards and refill, with no announcement.

**Killer** (Mob)
- Shift 1–2 cells / Collapse.
- **Kill** a living suspect in `N(you)`. There is no questioning.
- **Disguise:** as the Undercover Agent (`FM-10`).

**Maniac**
- **Start of turn (mandatory, `FM-9`):** every threatened suspect next to you dies, in reading
  order. This can hit your own teammates.
- **Actions:**
  - Shift / Collapse, or **Swap** any two neighbouring suspects anywhere in the city.
  - After any of these you must place threat tokens on 1–3 living, unthreatened suspects
    in a straight line within 3 of you.

**Bomber**
- Shift / Collapse.
- **Plant:** put a bomb on yourself or a neighbour.
- **Detonate** any bomb on the board:
  1. Its suspect dies.
  2. You must pick one living neighbour of it to die too.
  3. If that neighbour also had a bomb, it explodes in turn and you pick again, and so on.
     The chain stops at a suspect without a bomb, when there's nothing to hit, or when a
     protection is used.
  - `FM-4`: a bomb sitting on an arrested mobster (not the Bomber) survives the arrest. It may be
    detonated later; the arrested suspect itself doesn't die or count, but the blast continues.

**Sniper** (8 players)
- Shift 1–2 cells / Collapse.
- **Shoot** a living suspect diagonally within 3.
- **Prepare:** move a bomb, protection or threat token from any suspect to a neighbour of it that
  doesn't already have that token.

---

## 7. Casino Heist *(5–7 players, 7×7)*
A crew of specialist **thieves** must crack four vaults. One player is the **Security Chief**.

**The vaults**
- Each corner of the city holds a vault. Its **zone** is the 3×3 corner block (`HX-1`).
- The middle row and middle column belong to no zone; this is "the cross", and the exact centre is special.
- A vault is cracked when **3 theft tokens** sit in its zone at once. It is then removed and the
  zone goes inert (`HX-3`). Its tokens return to their owners.

**Setup**
- One player is the Security Chief; everyone else is a thief (4–6).
- **Thief roles** are public (`HX-9`; variant `hiddenThiefRoles`).
  - The role deck is the shuffled tier-1 roles on top of the shuffled tier-2 roles.
  - Each thief takes a role and one theft token (the Master Safecracker takes two).
- Each thief draws an identity. Thieves see each other's **starting** identities only; later
  changes stay private (variant `shareIdentityUpdates`).
- The Chief draws 7 cards and chooses **4 uniformed officers** (marked publicly) and **1 plainclothes
  officer** (secret). The rest are shuffled back. Variant `officerCount`: 3–5.
- Thieves move first, starting with a random thief (`HX-12`).

**Turn flow (`HX-4`)**
- Every thief action is either **overt** or **covert**.
- After an overt thief action, the Chief acts next.
- If every thief in turn acts covertly, the Chief acts after the last of them.
- All effects are public either way. Overt/covert only decides when the Chief moves.

**Every thief**
- **Start of turn:** take your theft token(s) back from the board.
  - The Safecracker doesn't.
  - The Master Safecracker doesn't when using *Crack*.
- **Shift (1 cell):** overt if the row or column contains a uniformed officer (stunned or not),
  otherwise covert. The plainclothes officer never makes a shift overt.
- **Rob (overt):** place or move your token into the vault zone of the quadrant you're standing in.
  `HX-10`: not into a vault that already holds your token.
- Your **role ability**, below.

**Tier-1 roles**
| Role | Ability |
|---|---|
| Safecracker | Passive: your token stays on the board at the start of your turn. |
| Runner | **Sprint** (overt): shift 1 or 2 cells. |
| Cleaner | **Knock out** (overt): stun a uniformed officer next to you; any other stunned officer wakes. `HX-5`: a stunned officer can't be an arrest source and can't be moved by the Chief's swap. |
| Front | **Vanish** (overt): shuffle your identity into the deck and draw a new one. |
| Insider | **Badge swap** (overt): trade places with any uniformed officer (`HX-6`: stunned ones too). |
| Hacker | **Remote job** (overt): from the cross, rob the vault of a quadrant next to you; from the exact centre, any vault. Not usable inside a quadrant (`HX-2`). |

**Tier-2 roles**
| Role | Ability |
|---|---|
| Eliminator | **Silence** (overt): a uniformed officer next to you dies and a new random officer is drawn. At most 3 times per role card (`HX-7`). |
| Copycat | **Assume identity** (overt): draw 3, keep one as your identity, shuffle the other two and your old identity into the deck. |
| Saboteur | **Slip** (covert): instead of shifting, trade places with a neighbouring suspect. |
| Snitch | **Quiet shift** (covert): a 1-cell shift that is always covert. |
| Master Safecracker | **Crack** (overt): keep your tokens out this turn. If your first token is in a vault zone and you are in that quadrant, place your second token there too. `HX-11`: both tokens count. |

**Security Chief actions**
- **Shift** 1 cell.
- **Swap:** a non-stunned uniformed officer trades places with a neighbour.
- **Accuse:** any suspect next to a non-stunned uniformed officer or next to the plainclothes
  officer. A thief caught this way loses their token from the board.
  - On their next turn they draw a new identity and a new role; that redraw is their whole turn.
  - `HX-8`: until then they have no identity.
- **Search:** choose a 4×4 square. Every thief inside is announced.

**Winning**
- The thieves win by cracking all **4 vaults**.
- The Chief wins by catching a thief when no thief roles are left to draw.

---

## 8. Variant switches (lobby options)
| Switch | Case | Default |
|---|---|---|
| `interrogateDeadOnBoard` | Shadow Duel, The Hit List, Feds vs. Mob | on (`KI-2`) |
| `teamsShareIdentities` | Spy Ring | off |
| `sevenPlayers` | Spy Ring | off |
| `forceFreeForAll` | Spy Ring | off |
| `hitListVisibleToHitman` | The Hit List | off |
| `chiefChoosesOfficers` | Cat Burglar | off |
| `fedsNeedOneMore` | Feds vs. Mob | off |
| `protectionConsumedOnUse` | Feds vs. Mob | off |
| `officerCount` (3–5) | Casino Heist | 4 |
| `hiddenThiefRoles` | Casino Heist | off |
| `shareIdentityUpdates` | Casino Heist | off |
| `stunBlocksLineShift` | Casino Heist | off |
| `turnTimer` (off / 60 / 90 / 120 s) | all | off; nudges only, never auto-moves |
