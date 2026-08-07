import {
  Anchor,
  Battery,
  Blocks,
  Boxes,
  Cable,
  Car,
  Cctv,
  Cpu,
  Drill,
  Fan,
  Gem,
  Hammer,
  HardHat,
  Headphones,
  Home,
  Laptop,
  Lightbulb,
  type LucideIcon,
  Monitor,
  Package,
  Paintbrush,
  Plug,
  Refrigerator,
  Ruler,
  ShoppingBasket,
  Smartphone,
  Sun,
  Tv,
  Wind,
  Wrench,
  Zap,
} from "lucide-react";

/** Curated icon set the admin can pick from for each category. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  package: Package,
  boxes: Boxes,
  basket: ShoppingBasket,
  smartphone: Smartphone,
  laptop: Laptop,
  monitor: Monitor,
  tv: Tv,
  headphones: Headphones,
  cpu: Cpu,
  cctv: Cctv,
  plug: Plug,
  cable: Cable,
  zap: Zap,
  lightbulb: Lightbulb,
  battery: Battery,
  sun: Sun,
  fan: Fan,
  wind: Wind,
  refrigerator: Refrigerator,
  hammer: Hammer,
  wrench: Wrench,
  drill: Drill,
  hardhat: HardHat,
  blocks: Blocks,
  ruler: Ruler,
  paintbrush: Paintbrush,
  home: Home,
  car: Car,
  anchor: Anchor,
  gem: Gem,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function CategoryIcon({
  icon,
  imageUrl,
  fallback,
  className = "",
}: {
  icon?: string | null;
  imageUrl?: string | null;
  fallback?: string;
  className?: string;
}) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  const Icon = icon ? CATEGORY_ICONS[icon] : undefined;
  if (Icon) return <Icon className={`size-1/2 text-primary ${className}`} />;
  return <span className={`text-lg font-bold text-primary ${className}`}>{fallback ?? "•"}</span>;
}
