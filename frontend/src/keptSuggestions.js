const GUEST_KEY = "ruleshark_kept_suggestions";

export function loadGuestKept() {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestKept(items) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(items));
}

export function addGuestKept(item) {
  const existing = loadGuestKept();
  const next = [
    {
      ...item,
      id: item.id || `guest-${Date.now()}`,
      createdAt: item.createdAt || new Date().toISOString(),
    },
    ...existing.filter((entry) => entry.suggestionId !== item.suggestionId),
  ];
  saveGuestKept(next);
  return next;
}

export function removeGuestKept(id) {
  const next = loadGuestKept().filter((entry) => entry.id !== id);
  saveGuestKept(next);
  return next;
}
