function storageKey(value: string) {
  const marker = "/manus-storage/";
  const index = value.indexOf(marker);
  return index === -1 ? null : value.slice(index + marker.length).split("?")[0];
}

export function publicMediaUrl(value: string) {
  const key = storageKey(value);
  return key ? `/api/media/public/${encodeURIComponent(key)}` : value;
}

export function privateMediaUrl(value: string) {
  const key = storageKey(value);
  return key ? `/api/media/private/${encodeURIComponent(key)}` : value;
}
