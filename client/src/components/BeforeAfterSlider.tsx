import { Slider } from "@/components/ui/slider";
import { MediaImage } from "@/components/MediaImage";
import { privateMediaUrl } from "@/lib/mediaUrl";
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
  const beforeImage = privateMediaUrl(before);
  const afterImage = privateMediaUrl(after);

  return (
    <figure className="comparison-proof" style={{ aspectRatio }}>
      <MediaImage className="comparison-after" src={afterImage} alt="Hasil transformasi AI" fallbackLabel="Hasil tidak tersedia" />
      <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - reveal}% 0 0)` }}>
        <MediaImage src={beforeImage} alt="Foto sebelum transformasi" fallbackLabel="Foto sumber tidak tersedia" />
      </div>
      <span className="comparison-label comparison-before-label">{beforeLabel}</span>
      <span className="comparison-label comparison-after-label">{afterLabel}</span>
      <button type="button" className="comparison-reset" onClick={() => setReveal(50)} aria-label="Kembalikan pembanding ke posisi tengah">TENGAH</button>
      <div className="comparison-split" style={{ left: `${reveal}%` }} aria-hidden="true"><span /></div>
      <div className="comparison-control"><Slider value={[reveal]} min={0} max={100} step={1} onValueChange={([value]) => setReveal(value ?? 50)} aria-label="Geser untuk membandingkan sebelum dan sesudah" /></div>
    </figure>
  );
}
