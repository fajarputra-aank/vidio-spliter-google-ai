export type ArchiveCsvItem = {
  title: string;
  recipe: string;
  style: string;
  aspectRatio: string;
  createdAt: Date | string;
  isHidden?: boolean;
};

const quote = (value: string | number | boolean | null | undefined) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function createArchiveCsv(items: ArchiveCsvItem[]) {
  const header = ["judul", "resep", "gaya", "rasio", "dibuat_pada", "tersembunyi"];
  const rows = items.map((item) => [item.title, item.recipe, item.style, item.aspectRatio, new Date(item.createdAt).toISOString(), item.isHidden ? "ya" : "tidak"]);
  return [header, ...rows].map((row) => row.map(quote).join(",")).join("\n");
}

export function downloadArchiveCsv(items: ArchiveCsvItem[], documentRef: Document = document, urlApi: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL) {
  const blob = new Blob(["\ufeff", createArchiveCsv(items)], { type: "text/csv;charset=utf-8" });
  const url = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement("a");
  anchor.href = url;
  anchor.download = `arsip-lensa-saku-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  urlApi.revokeObjectURL(url);
}
