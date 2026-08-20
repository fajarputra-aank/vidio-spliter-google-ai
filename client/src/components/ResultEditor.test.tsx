import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trpc", () => ({
  trpc: { useUtils: () => ({ photo: { list: { invalidate: vi.fn() }, collaborationProjects: { invalidate: vi.fn() }, getById: { invalidate: vi.fn() } } }), photo: { hdExport: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) }, deletePhotoTransform: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) } } },
}));
import { ResultEditor } from "./ResultEditor";

describe("ResultEditor", () => {
  it("renders a non-destructive text and watermark control surface before download", () => {
    const markup = renderToStaticMarkup(<ResultEditor imageUrl="https://example.test/result.jpg" title="Headshot rapi" transformId={42} />);

    expect(markup).toContain("https://example.test/result.jpg");
    expect(markup).toContain("Teks kustom");
    expect(markup).toContain("Watermark Lensa Saku");
    expect(markup).toContain("Jenis font");
    expect(markup).toContain("Warna teks");
    expect(markup).toContain("Posisi teks dan watermark");
    expect(markup).toContain("Unduh versi berlapis");
    expect(markup).toContain("Unduh HD");
    expect(markup).toContain("Hapus foto");
  });
});
