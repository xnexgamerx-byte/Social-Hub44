import type { Server, Socket } from "socket.io";

export interface MicSeat {
  userId: string;
  userName: string;
  userAvatar: string;
  muted: boolean;
}

const MAX_SEATS = 12;

// roomId -> (userId -> MicSeat). In-memory: the audio stage is ephemeral state.
const roomSeats = new Map<string, Map<string, MicSeat>>();

function roomChannel(roomId: string): string {
  return `room:${roomId}`;
}

function seatsFor(roomId: string): Map<string, MicSeat> {
  let seats = roomSeats.get(roomId);
  if (!seats) {
    seats = new Map();
    roomSeats.set(roomId, seats);
  }
  return seats;
}

export function getSeats(roomId: string): MicSeat[] {
  return Array.from(roomSeats.get(roomId)?.values() ?? []);
}

function broadcast(io: Server, roomId: string): void {
  io.to(roomChannel(roomId)).emit("mic:state", { roomId, seats: getSeats(roomId) });
}

export function emitSnapshot(socket: Socket, roomId: string): void {
  socket.emit("mic:state", { roomId, seats: getSeats(roomId) });
}

/** Take a seat on the audio stage. Returns false when the stage is full. */
export function joinMic(io: Server, roomId: string, seat: MicSeat): boolean {
  const seats = seatsFor(roomId);
  if (!seats.has(seat.userId) && seats.size >= MAX_SEATS) return false;
  seats.set(seat.userId, seat);
  broadcast(io, roomId);
  return true;
}

export function leaveMic(io: Server, roomId: string, userId: string): void {
  const seats = roomSeats.get(roomId);
  if (!seats) return;
  if (seats.delete(userId)) {
    if (seats.size === 0) roomSeats.delete(roomId);
    broadcast(io, roomId);
  }
}

export function setMute(io: Server, roomId: string, userId: string, muted: boolean): void {
  const seat = roomSeats.get(roomId)?.get(userId);
  if (seat && seat.muted !== muted) {
    seat.muted = muted;
    broadcast(io, roomId);
  }
}
