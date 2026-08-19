import { ImageOff, LoaderCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import type { ImgHTMLAttributes } from "react";

type MediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  fallbackLabel?: string;
  retryLabel?: string;
};

export function buildMediaReloadUrl(src: string, attempt: number) {
  return attempt ? `${src}${src.includes("?") ? "&" : "?"}reload=${attempt}` : src;
}

export function MediaImage({ src, alt, className, fallbackLabel = "Gambar belum tersedia", retryLabel = "Coba muat ulang", onError, onLoad, ...props }: MediaImageProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">(src ? "loading" : "error");
  const [reloadAttempt, setReloadAttempt] = useState(0);

  useEffect(() => { setState(src ? "loading" : "error"); setReloadAttempt(0); }, [src]);
  const imageSrc = src ? buildMediaReloadUrl(src, reloadAttempt) : src;

  return <span className={`media-image media-image--${state}`} aria-busy={state === "loading"}>
    {state === "loading" && <span className="media-image-skeleton" aria-label="Memuat gambar"><LoaderCircle className="spin-icon" size={16} /></span>}
    {state === "error" && <span className="media-image-fallback" role="status"><ImageOff size={18} /><small>{fallbackLabel}</small>{src && <button type="button" onClick={() => { setState("loading"); setReloadAttempt((current) => current + 1); }}>{retryLabel}</button>}</span>}
    {imageSrc && <img {...props} className={className} src={imageSrc} alt={alt ?? ""} onLoad={(event) => { setState("ready"); onLoad?.(event); }} onError={(event) => { setState("error"); onError?.(event); }} />}
  </span>;
}
