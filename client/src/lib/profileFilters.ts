export type ArchiveFilterItem = { title: string; recipe: string; style: string; aspectRatio: string };
export type AlbumFilterItem = { name: string };

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

export function filterArchive<T extends ArchiveFilterItem>(items: T[], input: { search: string; style: string; aspectRatio: string }) {
  const query = normalized(input.search);
  return items.filter((item) => (!query || `${item.title} ${item.recipe} ${item.style}`.toLocaleLowerCase("id-ID").includes(query)) && (input.style === "all" || item.style === input.style) && (input.aspectRatio === "all" || item.aspectRatio === input.aspectRatio));
}

export function filterAlbums<T extends AlbumFilterItem>(items: T[], search: string) {
  const query = normalized(search);
  return items.filter((item) => !query || item.name.toLocaleLowerCase("id-ID").includes(query));
}

export function sortArchiveItems<T extends ArchiveFilterItem & { createdAt: Date | string }>(items: T[], order: "newest" | "oldest" | "aspect") {
  return [...items].sort((left, right) => {
    if (order === "aspect") return left.aspectRatio.localeCompare(right.aspectRatio) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    const delta = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return order === "newest" ? delta : -delta;
  });
}

export function filterArchiveDateRange<T extends { createdAt: Date | string }>(items: T[], startDate: string, endDate: string) {
  const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
  const end = endDate ? new Date(`${endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
  return items.filter((item) => {
    const createdAt = new Date(item.createdAt).getTime();
    return createdAt >= start && createdAt <= end;
  });
}
