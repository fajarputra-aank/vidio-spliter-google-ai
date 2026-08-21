import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({ trpc: { useUtils: () => ({ photo: { list: { invalidate: vi.fn() }, getById: { invalidate: vi.fn() }, collaborationProjects: { invalidate: vi.fn() } } }), photo: { setHidden: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) }, deleteFailedTransforms: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } } }));
import { FailedPhotoDeletePanel } from "./FailedPhotoDeletePanel";

describe("FailedPhotoDeletePanel", () => {
  it("menampilkan filter, multi-select, dan arsip hanya untuk proses gagal yang diberikan", () => {
    const markup = renderToStaticMarkup(<FailedPhotoDeletePanel items={[{ id: 12, title: "Menu sore", createdAt: "2026-08-20T00:00:00.000Z", errorMessage: "Koneksi sementara." }]} archivedItems={[{ id: 13, title: "Produk pagi", createdAt: "2026-08-19T00:00:00.000Z" }]} formatDate={() => "20 Agu 2026"} />);
    expect(markup).toContain("Pilih semua yang tampil");
    expect(markup).toContain("Semua jenis kegagalan");
    expect(markup).toContain("Arsipkan");
    expect(markup).toContain("Pulihkan");
    expect(renderToStaticMarkup(<FailedPhotoDeletePanel items={[]} archivedItems={[]} formatDate={() => ""} />)).toBe("");
  });
});
