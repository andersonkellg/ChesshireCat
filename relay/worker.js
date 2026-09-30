/**
 * Chesshire Cat relay: a small, forgetful pipe between two players.
 *
 *   Does:   puts two browsers that know the same room ID in touch and passes
 *           their messages back and forth.
 *   Can't:  read those messages. They are encrypted in the browser with a key
 *           made from the secret code, and the code never comes here.
 *   Keeps:  nothing. No storage, no logs (see wrangler.toml). A room only
 *           exists while someone is connected to it.
 *
 * The whole protocol, as the relay sees it:
 *   browser -> relay    GET /room/<64 hex>?seat=<32 hex>   WebSocket upgrade
 *                       (the seat is a random number each player picks, so a
 *                       player who reconnects gets their own seat back)
 *   relay   -> browser  {"relay":"waiting"}          first player is in
 *   relay   -> both     {"relay":"paired"}           second player is in
 *   browser -> relay    "<base64url>.<base64url>"    passed to the other player untouched
 *   relay   -> browser  {"relay":"peer-left"}        the other player disconnected
 *   browser -> relay    "ping", answered "pong"      keep-alive
 */
import { DurableObject } from 'cloudflare:workers';

const SEATS = 2;
const MAX_MESSAGE_CHARS = 64 * 1024;
const MAX_MESSAGES_PER_MINUTE = 120;
// Browsers ping every 20 s. A seat silent for a minute belongs to someone who
// lost signal without saying goodbye, so it's given up to whoever arrives next.
const GHOST_AFTER_MS = 60_000;
const ROOM_PATH = /^\/room\/([0-9a-f]{64})$/;
const SEAT = /^[0-9a-f]{32}$/;
// What an encrypted message looks like (12-byte IV "." ciphertext). Nothing
// else is forwarded, so players can't send each other plain text or fake
// relay notes.
const SEALED = /^[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response('Chesshire Cat relay. Source and privacy notes: https://github.com/andersonkellg/ChesshireCat\n');
    }

    const room = url.pathname.match(ROOM_PATH);
    if (!room) return new Response('Not found\n', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket\n', { status: 426 });
    }
    const seat = url.searchParams.get('seat');
    if (seat !== null && !SEAT.test(seat)) return new Response('Bad seat\n', { status: 400 });
    if (!originAllowed(request.headers.get('Origin'), env.ALLOWED_ORIGINS)) {
      return new Response('Forbidden\n', { status: 403 });
    }
    if (env.JOIN_LIMITER) {
      // Slows down anyone trying to guess rooms. Cloudflare keeps this count
      // briefly in memory; this code never stores the IP address.
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.JOIN_LIMITER.limit({ key: ip });
      if (!success) return new Response('Too many tries. Wait a minute.\n', { status: 429 });
    }

    return env.ROOMS.get(env.ROOMS.idFromName(room[1])).fetch(request);
  },
};

// Browsers always send an Origin header, so this stops other websites from
// using the relay. It's a speed bump, not a lock: scripts outside a browser
// can fake it. The real protection is the encryption.
function originAllowed(origin, allowed) {
  if (!allowed) return true;
  return allowed.split(',').map((o) => o.trim()).includes(origin || '');
}

// One Room per room ID. Holds at most two WebSockets and nothing else.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keep-alive pings are answered by Cloudflare without waking the room
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    const seat = new URL(request.url).searchParams.get('seat');

    this.releaseGhostSeats(seat);
    if (this.players().length >= SEATS) {
      server.accept();
      server.close(4001, 'room-full');
      return new Response(null, { status: 101, webSocket: client });
    }

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat, lastSeen: Date.now(), windowStart: Date.now(), count: 0 });

    const players = this.players();
    if (players.length === SEATS) {
      for (const ws of players) ws.send(JSON.stringify({ relay: 'paired' }));
    } else {
      server.send(JSON.stringify({ relay: 'waiting' }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_CHARS || !SEALED.test(message)) {
      ws.close(4003, 'not-encrypted');
      return;
    }
    if (this.tooFast(ws)) {
      ws.close(4008, 'too-fast');
      return;
    }
    for (const other of this.players()) {
      if (other !== ws) other.send(message);
    }
  }

  webSocketClose(ws) {
    this.leave(ws);
  }

  webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const ghost = (ws.deserializeAttachment() || {}).ghost;
    try {
      ws.close(1000, 'bye');
    } catch {
      // already closed
    }
    if (ghost) return;   // its seat was already handed to someone else
    for (const other of this.players()) {
      if (other !== ws) other.send(JSON.stringify({ relay: 'peer-left' }));
    }
  }

  players() {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === WebSocket.OPEN);
  }

  // Frees seats held by connections that are gone: the arriving player's own
  // earlier connection (same seat number), or one that's been silent too long.
  releaseGhostSeats(seat) {
    const now = Date.now();
    for (const ws of this.players()) {
      const info = ws.deserializeAttachment() || {};
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      const lastSeen = Math.max(info.lastSeen || 0, pinged ? pinged.getTime() : 0);
      const sameSeat = seat !== null && info.seat === seat;
      if (sameSeat || now - lastSeen > GHOST_AFTER_MS) {
        ws.serializeAttachment({ ...info, ghost: true });
        ws.close(4000, sameSeat ? 'replaced' : 'timed-out');
      }
    }
  }

  // A per-connection message budget, kept on the socket itself (not stored)
  tooFast(ws) {
    const now = Date.now();
    const info = ws.deserializeAttachment() || { windowStart: now, count: 0 };
    if (now - info.windowStart > 60_000) {
      info.windowStart = now;
      info.count = 0;
    }
    info.count += 1;
    info.lastSeen = now;
    ws.serializeAttachment(info);
    return info.count > MAX_MESSAGES_PER_MINUTE;
  }
}
