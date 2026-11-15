export function canDeleteMessage(senderId: string, activeProfileId: string): boolean {
  return senderId === activeProfileId;
}
