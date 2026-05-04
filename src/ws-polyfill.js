/**
 * Importar em `server.js` antes de qualquer `./db/*`.
 * Node 18–21 não define `globalThis.WebSocket`; Realtime do Supabase precisa disto.
 */
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket;
}
