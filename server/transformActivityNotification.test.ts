import { describe, expect, it } from "vitest";
import { getPhotoTransformCompletionActivity } from "./db";

describe("notifikasi penyelesaian transformasi", () => {
  it("menjelaskan pemulihan ketika transformasi selesai setelah pengulangan otomatis", () => {
    expect(getPhotoTransformCompletionActivity({ title: "Potret produk", providerAttemptCount: 2 })).toEqual({
      title: "Transformasi selesai setelah pemulihan",
      content: "“Potret produk” berhasil diselesaikan setelah sistem mencoba ulang akibat gangguan sementara.",
    });
  });

  it("menggunakan notifikasi selesai standar ketika hanya ada satu percobaan", () => {
    expect(getPhotoTransformCompletionActivity({ title: "Potret produk", providerAttemptCount: 1 }).title).toBe("Transformasi selesai");
  });
});
