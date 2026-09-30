# Privacy and security

Chesshire Cat is one web page (`index.html`). Playing against the computer or
with two people on one screen never touches the internet at all. This page
explains **Online friend** mode: what is protected, what isn't, and how to
check it yourself.

## The short version

- You and your friend share a **secret code** (four random words, like
  `velvet-otter-lantern-maple`).
- Your browser turns that code into an encryption key. **Every move is
  encrypted on your device** before it leaves.
- A tiny relay passes the encrypted messages between the two of you. It can't
  read them, it never sees the secret code, and **it stores nothing**.
- When you leave, the game is gone. No accounts, no history, no analytics, no
  cookies.

## Who can see what

| Who | Can see | Can't see |
|---|---|---|
| **Your friend** | Your name, your moves | Your IP address, anything else on your device |
| **The relay** (Cloudflare) | That *a* room is in use, when, the IP addresses connecting to it, and a random seat number per player (so a reconnecting phone gets its own seat back) | Names, moves, the secret code, which game you're playing |
| **GitHub** (hosts the page) | That someone loaded the page | Anything about games |
| **Anyone else** | Nothing | Everything |

## How the secret code works

1. The code is stretched with PBKDF2 (200,000 rounds of SHA-256) into 64
   random-looking bytes.
2. The first 32 bytes become the **room ID**, the only thing sent to the
   relay. Two people with the same code land in the same room.
3. The last 32 bytes become an **AES-GCM key** that never leaves the page.
   Every message is encrypted with it, and any tampering is detected.

A generated code is 4 words from a list of 494, which gives about 60 billion
possible codes (~36 bits). That's plenty to keep strangers out of a chess game,
and the relay slows down anyone trying to guess.

## Guardrails (what happens if someone tries something)

| Someone tries to… | What happens |
|---|---|
| Move your pieces, move twice, or make an illegal move | Your page checks every move against its own rules and ignores anything invalid. |
| Rewrite the game's history or claim you resigned | Refused. Only your own moves come from you, and a player can only resign for themselves. |
| Join a game that already has two players | The relay turns them away. Taking over a player's seat would need their random seat number, which only their own device knows. |
| Guess secret codes | 20 tries per minute per IP address, against billions of codes. |
| Send plain text, fake "your friend left" notes, or huge or rapid messages | The relay only forwards encrypted messages and disconnects anyone who floods it. |
| Use a name with HTML or invisible characters | Names are cut to 20 characters, cleaned, and only ever shown as plain text. |
| Replay old messages | Each message carries a sequence number, and old ones are dropped. |
| Point your page at a different server | The page's security policy only allows connecting to the one relay listed in `index.html`. |

## What we can't hide

- **IP addresses reach Cloudflare**, as with any website. The relay code never
  logs or stores them, and logging is switched off in `relay/wrangler.toml`.
  Cloudflare's own network may keep standard traffic records; that's outside
  this project's control.
- **Anyone who has your secret code can join.** Only send it to your friend.
  If a stranger gets it, just Leave and make a new one.
- **Homemade codes are weaker.** The 🎲 button makes strong ones; typed codes
  must be four words with at least 12 letters in total.
- **You trust the page you load.** If the hosted page were ever altered, it
  could leak moves. See "Check it yourself" below.

## Check it yourself

Everything is in two small places:

- `index.html`: search for **ONLINE PLAY**. That section is the entire online
  feature: secret codes, encryption, connection, and move checking.
- `relay/worker.js`: the whole relay, about 150 lines including comments.

Quick checks anyone can do:

1. **Where can the page connect?** Search `index.html` for
   `Content-Security-Policy`. The `connect-src` entry is the only server the
   browser will let it talk to.
2. **Is the relay logging?** Look for `[observability] enabled = false` in
   `relay/wrangler.toml`, and notice `worker.js` never calls `console.log` or
   uses storage.
3. **Is my copy the published one?** Each release lists the SHA-256 of
   `index.html`. Compare it with `shasum -a 256 index.html` on Mac/Linux, or
   save the file from a release and open it locally instead of from the
   website.
4. **Watch it work:** open your browser's developer tools → Network → WS
   while playing. Every message after the first two is scrambled text.
