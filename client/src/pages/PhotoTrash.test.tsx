import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ loading: false, isAuthenticated: true }) }));
vi.mock("wouter", () => ({ Link: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ photo: { list: { invalidate: vi.fn() }, trash: { invalidate: vi.fn() }, collaborationProjects: { invalidate: vi.fn() }, getById: { invalidate: vi.fn() } } }),
  photo: {
    list: { useQuery: () => ({ isLoading: false, data: [{ id: 4, title: "Portrait sore", status: "completed", resultUrl: "/api/media/private/a", sourceUrl: "/api/media/private/source", style: "editorial", aspectRatio: "1:1" }] }) },
    trash: { useQuery: () => ({ isLoading: false, data: [{ id: 8, title: "Foto terhapus", status: "completed", resultUrl: "/api/media/private/b", sourceUrl: "/api/media/private/source-b", style: "realistic", aspectRatio: "16:9", trashExpiresAt: new Date("2026-09-19T00:00:00.000Z") }] }) },
    moveToTrash: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    restoreFromTrash: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
    deletePhotoTransform: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
  },
} }));
import PhotoTrash from "./PhotoTrash";

describe("PhotoTrash", () => {
  it("menampilkan pilihan banyak, aksi pindah ke Sampah, serta pemulihan dalam 30 hari", () => {
    const markup = renderToStaticMarkup(<PhotoTrash />);
    expect(markup).toContain("Pilih semua");
    expect(markup).toContain("Pilih");
    expect(markup).toContain("Pulihkan dalam 30 hari");
    expect(markup).toContain("Hapus foto");
  });
});
