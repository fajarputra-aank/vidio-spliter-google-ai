import { describe, expect, it } from "vitest";
import { filterAlbums, filterArchive, sortArchiveItems } from "./profileFilters";

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

  it("sorts archive frames by creation date or aspect ratio without mutating the source", () => {
    const datedFrames = [
      { ...frames[0], createdAt: "2026-08-10T00:00:00.000Z" },
      { ...frames[1], createdAt: "2026-08-14T00:00:00.000Z" },
      { ...frames[2], createdAt: "2026-08-12T00:00:00.000Z" },
    ];
    expect(sortArchiveItems(datedFrames, "newest").map((item) => item.title)).toEqual(["Makan malam", "Potret kerja", "Produk kayu"]);
    expect(sortArchiveItems(datedFrames, "oldest").map((item) => item.title)).toEqual(["Produk kayu", "Potret kerja", "Makan malam"]);
    expect(sortArchiveItems(datedFrames, "aspect").map((item) => item.aspectRatio)).toEqual(["1:1", "16:9", "9:16"]);
    expect(datedFrames.map((item) => item.title)).toEqual(["Produk kayu", "Makan malam", "Potret kerja"]);
  });
});
