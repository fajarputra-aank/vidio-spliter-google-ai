import { describe, expect, it } from "vitest";
import { getManualTransferNotification } from "./manualTransferNotifications";

describe("manual transfer notifications", () => {
  it("explains when approved credits have been issued", () => {
    expect(getManualTransferNotification("approve", 25)).toMatchObject({ title: "Transfer BCA disetujui", content: expect.stringContaining("25 kredit") });
  });

  it("does not claim that credits were issued when a proof is rejected", () => {
    expect(getManualTransferNotification("reject", 25)).toMatchObject({ title: "Transfer BCA ditolak", content: expect.not.stringContaining("ditambahkan") });
  });
});
