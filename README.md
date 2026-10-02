# ChesshireCat

Chess and checkers in a single web page. Play against the computer
("Chessckers"), with two people on one screen, or with a friend online.

With two people on one screen, **Board: Turns each move** spins the board
so whoever's turn it is has their pieces at the bottom (handy when passing
one device back and forth); **Stays put** suits players sitting across a
table. Every part of the code is annotated in plain English for anyone
curious how it works: start at the top of `index.html`.

**Play:** https://andersonkellg.github.io/ChesshireCat/ (also installs as an
app from the browser's *Add to Home Screen*).

## Playing online with a friend

1. Choose **Opponent → Online friend**, pick the game and your color.
2. Tap 🎲 for a four-word secret code, then **Create game**.
3. Tap **Share invite** and send it to your friend (Messages, email, anything).
4. Your friend opens the link, or types the four words into the four boxes, and
   taps **Join game**.
5. For another game in the same room, whoever created the game (the host)
   picks the game and their color and taps **Offer new game**. The friend can
   **Accept**, ask to **Swap colors** or switch to the other game, or
   **Decline**. If they ask for a change, the host can **Approve** it or offer
   something else. The friend can also tap **Ask for new game** at any time.

If a screen goes to sleep, the game waits and picks up where it left off.

Moves are encrypted on your device with the secret code. The relay in the
middle only passes scrambled messages along and keeps nothing. The details,
and how to check them yourself, are in [PRIVACY.md](PRIVACY.md).

## What's in here

| File | What it is |
|---|---|
| `index.html` | The whole game: rules, computer player, board, and online play. No libraries, no build step. |
| `relay/` | The optional online-play relay (a small Cloudflare Worker) and how to deploy your own |
| `sw.js`, `manifest.webmanifest` | Offline support and home-screen install |
| `PRIVACY.md` | What online play protects, what it doesn't, and how to verify it |

## Running your own copy

Fork the repo and turn on GitHub Pages. Everything except online play works as
is. For online play, deploy your own relay; see
[relay/README.md](relay/README.md). It fits in Cloudflare's free plan.

## License

[MIT](LICENSE)
