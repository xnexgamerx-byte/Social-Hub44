import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  socket = io(`https://${domain}`, {
    path: "/api/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
  });

  return socket;
}
