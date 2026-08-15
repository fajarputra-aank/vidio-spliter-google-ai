export const creditPacks = {
  starter: { id: "starter", title: "Paket Saku", credits: 8, unitAmount: 199, currency: "usd" },
  studio: { id: "studio", title: "Paket Studio", credits: 25, unitAmount: 499, currency: "usd" },
  archive: { id: "archive", title: "Paket Arsip", credits: 60, unitAmount: 999, currency: "usd" },
} as const;

export type CreditPackId = keyof typeof creditPacks;

export function getCreditPack(id: string) {
  return creditPacks[id as CreditPackId] ?? null;
}
