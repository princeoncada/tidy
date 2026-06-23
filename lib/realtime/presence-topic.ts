export function presenceTopicForRoom(roomId: string): string {
  return `tidy:presence:${roomId}`;
}
