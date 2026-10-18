/** Video consultation rooms (OC, Step 6). Room IDs are opaque; no names in them. */
export interface VideoRooms {
  createRoom(bookingId: string): Promise<{ roomId: string }>;
  joinToken(roomId: string, participantId: string): Promise<string>;
}
export const VIDEO_ROOMS = Symbol('VIDEO_ROOMS');
