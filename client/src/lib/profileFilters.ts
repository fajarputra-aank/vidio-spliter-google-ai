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
