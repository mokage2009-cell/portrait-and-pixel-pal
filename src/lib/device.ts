const ACTIVE_PROFILE_KEY = "chat-device-id";
const SAVED_PROFILES_KEY = "chat-saved-profile-ids";

export function getDeviceId(): string {
  let id = localStorage.getItem(ACTIVE_PROFILE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  }
  return id;
}

export function getSavedProfileIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SAVED_PROFILES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberProfile(id: string): void {
  const ids = getSavedProfileIds();
  if (!ids.includes(id)) {
    localStorage.setItem(SAVED_PROFILES_KEY, JSON.stringify([...ids, id]));
  }
}

export function switchDeviceProfile(id: string): void {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}

export function createDeviceProfile(): string {
  const id = crypto.randomUUID();
  switchDeviceProfile(id);
  return id;
}
