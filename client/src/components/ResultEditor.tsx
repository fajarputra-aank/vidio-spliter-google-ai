import { Download, Stamp, Type } from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const positionClass: Record<Position, string> = {
  "top-left": "is-top-left",
  "top-right": "is-top-right",
  "bottom-left": "is-bottom-left",
  "bottom-right": "is-bottom-right",
};

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

export function ResultEditor({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [customText, setCustomText] = useState("");
  const [watermark, setWatermark] = useState(false);
  const [position, setPosition] = useState<Position>("bottom-right");
  const [opacity, setOpacity] = useState(68);
  const layers = useMemo(() => [customText.trim(), watermark ? "Lensa Saku" : ""].filter(Boolean), [customText, watermark]);

  async function exportEditedImage() {
    if (!layers.length) return toast.message("Tambahkan teks atau aktifkan watermark terlebih dahulu.");
    try {
      const image = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas tidak tersedia.");
      context.drawImage(image, 0, 0);
      context.globalAlpha = opacity / 100;
      context.fillStyle = "#fffdf8";
      context.strokeStyle = "rgba(27,27,24,.78)";
      context.lineWidth = Math.max(2, Math.round(canvas.width / 360));
      context.font = `700 ${Math.max(20, Math.round(canvas.width / 26))}px Manrope, Arial, sans-serif`;
      context.textBaseline = "middle";
      const padding = Math.max(28, Math.round(canvas.width / 25));
      const lineHeight = Math.max(28, Math.round(canvas.width / 20));
      const maxWidth = canvas.width - padding * 2;
      const estimatedCharacters = Math.max(10, Math.floor(maxWidth / (canvas.width / 35)));
      const textLines = layers.flatMap((layer) => {
        const matches = layer.match(new RegExp(`.{1,${estimatedCharacters}}(?:\\s|$)|\\S+?(?:\\s|$)`, "g"));
        return matches ?? [layer];
      });
      const alignRight = position.endsWith("right");
      const alignBottom = position.startsWith("bottom");
      context.textAlign = alignRight ? "right" : "left";
      let y = alignBottom ? canvas.height - padding - lineHeight * (textLines.length - 1) : padding;
      textLines.forEach((line) => {
        const x = alignRight ? canvas.width - padding : padding;
        context.strokeText(line.trim(), x, y);
        context.fillText(line.trim(), x, y);
        y += lineHeight;
      });
      const link = document.createElement("a");
      link.download = `lensa-saku-edited-${title.toLowerCase().replace(/\s+/g, "-")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Versi teks/watermark siap diunduh.");
    } catch {
      toast.error("Gambar tidak dapat dirender untuk ekspor. Coba gunakan tombol unduh asli.");
    }
  }

  return (
    <section className="result-editor" aria-label="Editor hasil ringan">
      <div className="editor-heading"><span><Type size={14} /> EDITOR HASIL</span><small>non-destruktif</small></div>
      <div className="editor-preview"><img src={imageUrl} alt="Pratinjau hasil dengan lapisan teks" />{layers.map((layer, index) => <span className={`editor-layer ${positionClass[position]}`} style={{ opacity: opacity / 100, transform: `translateY(${index * 1.2}em)` }} key={`${layer}-${index}`}>{layer}</span>)}</div>
      <label className="editor-input"><span>Teks kustom</span><input value={customText} maxLength={72} onChange={(event) => setCustomText(event.target.value)} placeholder="Contoh: Koleksi Raya 2026" /></label>
      <div className="editor-controls"><label><input type="checkbox" checked={watermark} onChange={(event) => setWatermark(event.target.checked)} /><Stamp size={14} /> Watermark Lensa Saku</label><label><span>Opasitas {opacity}%</span><input type="range" min="30" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /></label></div>
      <div className="editor-positions" aria-label="Posisi teks">{(["top-left", "top-right", "bottom-left", "bottom-right"] as Position[]).map((choice) => <button className={position === choice ? "is-selected" : ""} onClick={() => setPosition(choice)} key={choice}>{choice.replace("-", " ")}</button>)}</div>
      <button className="editor-export" onClick={() => void exportEditedImage()}><Download size={15} /> Unduh versi berlapis</button>
    </section>
  );
}
