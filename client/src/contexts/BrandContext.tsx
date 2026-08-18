import { trpc } from "@/lib/trpc";
import { applyBrandIdentity } from "@/lib/brandRuntime";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Brand = { logoUrl: string; iconUrl: string; updatedAt: Date | string | null };

const fallbackBrand: Brand = {
  logoUrl: "/manus-storage/fajar-nugroho-logo_8fa9d033.png",
  iconUrl: "/manus-storage/fnp-brand-icon_17f8efb6.png",
  updatedAt: null,
};

type BrandContextValue = { brand: Brand; applySavedBrand: (brand: Brand) => void };

const BrandContext = createContext<BrandContextValue>({ brand: fallbackBrand, applySavedBrand: () => undefined });

export function BrandProvider({ children }: { children: ReactNode }) {
  const { data } = trpc.brand.get.useQuery();
  const [savedBrand, setSavedBrand] = useState<Brand | null>(null);
  const brand = savedBrand ?? data ?? fallbackBrand;

  useEffect(() => {
    applyBrandIdentity(brand, document);
  }, [brand.iconUrl]);

  return <BrandContext.Provider value={{ brand, applySavedBrand: setSavedBrand }}>{children}</BrandContext.Provider>;
}

export function useBrand() {
  return useContext(BrandContext);
}
