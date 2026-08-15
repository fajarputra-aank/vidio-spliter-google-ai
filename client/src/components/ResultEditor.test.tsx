import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResultEditor } from "./ResultEditor";

describe("ResultEditor", () => {
  it("renders a non-destructive text and watermark control surface before download", () => {
    const markup = renderToStaticMarkup(<ResultEditor imageUrl="https://example.test/result.jpg" title="Headshot rapi" />);

    expect(markup).toContain("https://example.test/result.jpg");
    expect(markup).toContain("Teks kustom");
    expect(markup).toContain("Watermark Lensa Saku");
    expect(markup).toContain("Unduh versi berlapis");
  });
});
