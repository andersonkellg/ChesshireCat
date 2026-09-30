# Chesshire Cat relay

A Cloudflare Worker that pairs two players who know the same room ID and
passes their encrypted messages between them. It can't read them, stores
nothing, and forgets a room once both players leave. See `worker.js`, which is
the entire thing, and [../PRIVACY.md](../PRIVACY.md).

## Deploy your own

Works on Cloudflare's free plan.

```sh
cd relay
npx wrangler login
npx wrangler deploy
```

Wrangler prints the relay's address, e.g.
`https://chesshirecat-relay.<your-account>.workers.dev`. Then:

1. In `index.html`, put the address, starting with **`wss://`**, in two places:
   - `RELAY_URL` in the ONLINE PLAY section
   - `connect-src` in the `Content-Security-Policy` meta tag at the top
2. In `wrangler.toml`, set `ALLOWED_ORIGINS` to where your page is hosted,
   e.g. `https://<you>.github.io`. Keep `null` if people should be able to play
   from a downloaded copy of the file. Redeploy after changing it.
3. Check it: opening the address in a browser should say
   `Chesshire Cat relay. Source and privacy notes: …`.

A custom domain (e.g. `wss://chess-relay.example.com`) works too: add it
under the Worker's *Settings → Domains & Routes* in the Cloudflare dashboard.

### Settings in `wrangler.toml`

| Setting | Purpose |
|---|---|
| `[observability] enabled = false` | No request logs or traces are kept |
| `ALLOWED_ORIGINS` | Only these web pages may connect (a speed bump; the real protection is the encryption) |
| `[[ratelimits]] JOIN_LIMITER` | At most 20 room joins per minute per IP. Optional: remove the block to disable it |
| `new_sqlite_classes` | Required by the free plan. The relay never actually writes to storage |

### Limits in `worker.js`

- 2 players per room
- Messages must be encrypted, at most 64 KB, and at most 120 per minute per player
- Each player sends a random seat number. Reconnecting with the same number
  takes the seat straight back (e.g. after a phone's screen slept)
- A seat silent for 60 seconds (lost signal) is freed for whoever joins next

## Run it locally

```sh
cd relay
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8000
```

Then serve the game from `http://localhost:8000` with `RELAY_URL` and
`connect-src` temporarily pointed at `ws://localhost:8787`.
