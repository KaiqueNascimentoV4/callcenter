import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket;
}

export const supabase = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false },
  realtime: {
    transport: WebSocket,
  },
});
