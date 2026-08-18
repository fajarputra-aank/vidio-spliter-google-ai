export type ManualTransferOrder = { id: number; packId: string; credits: number; amountIdr: number; proofUrl?: string | null; status: "pending" | "approved" | "rejected"; createdAt?: Date | string };

export async function finalizeManualTransfer(input: { order: ManualTransferOrder; prependOrder: (order: ManualTransferOrder) => void; invalidateBalance: () => Promise<unknown> | unknown; clearSelection: () => void }) {
  input.prependOrder(input.order);
  input.clearSelection();
  await input.invalidateBalance();
}
