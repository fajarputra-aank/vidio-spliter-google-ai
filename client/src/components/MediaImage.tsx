import { ImageOff, LoaderCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";

type MediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallbackLabel?: string;
};

export function MediaImage({ src, alt, className, fallbackLabel = "Gambar belum tersedia", onError, onLoad, ...props }: MediaImageProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">(src ? "loading" : "error");

  useEffect(() => setState(src ? "loading" : "error"), [src]);

  return <span className={`media-image media-image--${state}`} aria-busy={state === "loading"}>
    {state === "loading" && <span className="media-image-skeleton" aria-label="Memuat gambar"><LoaderCircle className="spin-icon" size={16} /></span>}
    {state === "error" && <span className="media-image-fallback" role="status"><ImageOff size={18} /><small>{fallbackLabel}</small></span>}
    {src && <img {...props} className={className} src={src} alt={alt ?? ""} onLoad={(event) => { setState("ready"); onLoad?.(event); }} onError={(event) => { setState("error"); onError?.(event); }} />}
  </span>;
}
