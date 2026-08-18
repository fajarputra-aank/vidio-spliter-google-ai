export const creditPacks = {
  starter: { id: "starter", title: "Paket Saku", credits: 8, unitAmount: 15_000, currency: "idr" },
  studio: { id: "studio", title: "Paket Studio", credits: 25, unitAmount: 20_000, currency: "idr" },
  archive: { id: "archive", title: "Paket Arsip", credits: 60, unitAmount: 25_000, currency: "idr" },
} as const;

export type CreditPackId = keyof typeof creditPacks;

export function getCreditPack(id: string) {
  return creditPacks[id as CreditPackId] ?? null;
}
