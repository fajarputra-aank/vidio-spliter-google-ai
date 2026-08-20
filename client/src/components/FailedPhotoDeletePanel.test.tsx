import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./DeletePhotoResultControl", () => ({ DeletePhotoResultControl: ({ transformId }: { transformId: number }) => <button data-transform-id={transformId}>Hapus foto</button> }));
import { FailedPhotoDeletePanel } from "./FailedPhotoDeletePanel";

describe("FailedPhotoDeletePanel", () => {
  it("hanya merender tindakan hapus untuk daftar proses gagal yang diterimanya", () => {
    const markup = renderToStaticMarkup(<FailedPhotoDeletePanel items={[{ id: 12, title: "Menu sore", createdAt: "2026-08-20T00:00:00.000Z", errorMessage: "Gangguan sementara." }]} formatDate={() => "20 Agu 2026"} />);
    expect(markup).toContain("BERSIHKAN RIWAYAT GAGAL");
    expect(markup).toContain("Hapus foto");
    expect(markup).toContain("data-transform-id=\"12\"");
    expect(renderToStaticMarkup(<FailedPhotoDeletePanel items={[]} formatDate={() => ""} />)).toBe("");
  });
});
