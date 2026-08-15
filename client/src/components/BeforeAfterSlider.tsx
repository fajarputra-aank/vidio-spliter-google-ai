import { Slider } from "@/components/ui/slider";
import React, { useState } from "react";

type BeforeAfterSliderProps = {
  before: string;
  after: string;
  aspectRatio: string;
  beforeLabel?: string;
  afterLabel?: string;
};

/** Accessible proofing control: range input supports pointer, touch, and keyboard. */
export function BeforeAfterSlider({
  before,
  after,
  aspectRatio,
  beforeLabel = "SEBELUM",
  afterLabel = "SESUDAH",
}: BeforeAfterSliderProps) {
  const [reveal, setReveal] = useState(50);

  return (
    <figure className="comparison-proof" style={{ aspectRatio }}>
      <img className="comparison-after" src={after} alt="Hasil transformasi AI" />
      <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        <img src={before} alt="Foto sebelum transformasi" />
      </div>
      <span className="comparison-label comparison-before-label">{beforeLabel}</span>
      <span className="comparison-label comparison-after-label">{afterLabel}</span>
      <div className="comparison-split" style={{ left: `${reveal}%` }} aria-hidden="true"><span /></div>
      <div className="comparison-control"><Slider value={[reveal]} min={0} max={100} step={1} onValueChange={([value]) => setReveal(value ?? 50)} aria-label="Geser untuk membandingkan sebelum dan sesudah" /></div>
    </figure>
  );
}
