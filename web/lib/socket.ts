import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001", {
      transports: ["websocket"],
    });
  }
  return socket;
}

/** Identité persistante du joueur (survit au refresh → reconnexion à la table) */
export function getPlayerKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem("nioufi_key");
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem("nioufi_key", key);
  }
  return key;
}
