import type { ActiveBrand } from "./brandRuntime";

export async function finalizeBrandSave(input: { brand: ActiveBrand; applyActiveBrand: (brand: ActiveBrand) => void; invalidateBrand: () => Promise<unknown> | unknown; resetDrafts: () => void }) {
  input.applyActiveBrand(input.brand);
  await input.invalidateBrand();
  input.resetDrafts();
}
