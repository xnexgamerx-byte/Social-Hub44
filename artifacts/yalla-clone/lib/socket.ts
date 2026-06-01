import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let tokenGetter: (() => Promise<string | null> | string | null) | null = null;

/**
 * Register a getter that supplies the Clerk session token used to authenticate
 * the socket handshake. The server reads `socket.handshake.auth.token` and
 * derives the user identity from it, so this must be set before connecting.
 */
export function setSocketTokenGetter(
  getter: (() => Promise<string | null> | string | null) | null,
): void {
  tokenGetter = getter;
}

export function getSocket(): Socket {
  if (socket) return socket;

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  socket = io(`https://${domain}`, {
    path: "/api/socket.io",
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    auth: (cb) => {
      Promise.resolve(tokenGetter ? tokenGetter() : null)
        .then((token) => cb({ token: token ?? "" }))
        .catch(() => cb({ token: "" }));
    },
  });

  return socket;
}
