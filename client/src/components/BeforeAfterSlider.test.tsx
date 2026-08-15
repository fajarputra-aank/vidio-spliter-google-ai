import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

describe("BeforeAfterSlider", () => {
  it("renders source, result, labels, and a range control for visual comparison", () => {
    const markup = renderToStaticMarkup(
      <BeforeAfterSlider before="https://example.test/source.jpg" after="https://example.test/result.jpg" aspectRatio="1:1" />
    );

    expect(markup).toContain("https://example.test/source.jpg");
    expect(markup).toContain("https://example.test/result.jpg");
    expect(markup).toContain("SEBELUM");
    expect(markup).toContain("SESUDAH");
    expect(markup).toContain('aria-label="Geser untuk membandingkan sebelum dan sesudah"');
  });
});
