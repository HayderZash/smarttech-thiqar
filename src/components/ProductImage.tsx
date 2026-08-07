import { useQuery } from "@tanstack/react-query";

import { settingsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export type CropSettings = { zoom: number; x: number; y: number };

export const DEFAULT_CROP: CropSettings = { zoom: 160, x: 50, y: 46 };

function num(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function useCropSettings(): CropSettings {
  const { data } = useQuery(settingsQuery);
  return {
    zoom: num(data?.["img_crop_zoom"], DEFAULT_CROP.zoom),
    x: num(data?.["img_crop_x"], DEFAULT_CROP.x),
    y: num(data?.["img_crop_y"], DEFAULT_CROP.y),
  };
}

export function cropStyle(c: CropSettings): React.CSSProperties {
  return {
    position: "absolute",
    width: `${c.zoom}%`,
    height: `${c.zoom}%`,
    maxWidth: "none",
    left: `${c.x}%`,
    top: `${c.y}%`,
    transform: "translate(-50%, -50%)",
    objectFit: "cover",
  };
}

export function ProductImage({
  src,
  alt,
  crop,
  className,
  loading,
}: {
  src: string;
  alt: string;
  crop?: CropSettings;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const settings = useCropSettings();
  const c = crop ?? settings;
  return (
    <img src={src} alt={alt} loading={loading} className={cn(className)} style={cropStyle(c)} />
  );
}
