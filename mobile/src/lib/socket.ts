import { io, Socket } from "socket.io-client";
import * as Crypto from "expo-crypto";
import { API } from "./config";
import { store } from "./storage";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API, { transports: ["websocket"], reconnection: true });
  }
  return socket;
}

/** Identité invité persistante (survit à la fermeture de l'appli → reconnexion à la table).
 *  Chargée une fois au démarrage avec loadPlayerKey(). */
let playerKey = "";

export async function loadPlayerKey(): Promise<string> {
  if (playerKey) return playerKey;
  let key = await store.get("nioufi_key");
  if (!key) {
    key = Crypto.randomUUID();
    await store.set("nioufi_key", key);
  }
  playerKey = key;
  return key;
}

export function getPlayerKey(): string {
  return playerKey;
}
