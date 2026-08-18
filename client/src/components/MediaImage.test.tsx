import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MediaImage } from "./MediaImage";

describe("MediaImage", () => {
  it("renders the loading state, accessible image, and fallback label contract", () => {
    const loadingMarkup = renderToStaticMarkup(<MediaImage src="/frame.jpg" alt="Frame uji" fallbackLabel="Frame riwayat tidak tersedia" />);
    const emptyMarkup = renderToStaticMarkup(<MediaImage src={null} alt="Frame hilang" fallbackLabel="Frame riwayat tidak tersedia" />);
    expect(loadingMarkup).toContain('aria-label="Memuat gambar"');
    expect(loadingMarkup).toContain('alt="Frame uji"');
    expect(emptyMarkup).toContain("Frame riwayat tidak tersedia");
  });
});
