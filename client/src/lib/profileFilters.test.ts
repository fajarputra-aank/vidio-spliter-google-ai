import { describe, expect, it } from "vitest";
import { filterAlbums, filterArchive } from "./profileFilters";

const frames = [
  { title: "Produk kayu", recipe: "product", style: "editorial", aspectRatio: "1:1" },
  { title: "Makan malam", recipe: "food", style: "cinematic", aspectRatio: "16:9" },
  { title: "Potret kerja", recipe: "headshot", style: "realistic", aspectRatio: "9:16" },
];

describe("profile archive and album filters", () => {
  it("combines a keyword with style and aspect filters", () => {
    expect(filterArchive(frames, { search: "makan", style: "cinematic", aspectRatio: "16:9" })).toEqual([frames[1]]);
    expect(filterArchive(frames, { search: "", style: "editorial", aspectRatio: "all" })).toEqual([frames[0]]);
  });

  it("finds private albums by a case-insensitive name fragment", () => {
    const albums = [{ name: "Konten Lebaran" }, { name: "Foto Produk" }];
    expect(filterAlbums(albums, "produk")).toEqual([albums[1]]);
    expect(filterAlbums(albums, "")).toEqual(albums);
  });
});
