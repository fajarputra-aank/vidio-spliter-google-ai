import { describe, expect, it } from "vitest";
import { parseCollaborationFaceReadiness } from "./collaborationFaceReadiness";

describe("pemeriksaan kesiapan wajah Kolaborasi", () => {
  it("menerima hanya status dan isu teknis yang dibatasi tanpa identitas", () => {
    const result = parseCollaborationFaceReadiness(JSON.stringify({ overall: "attention", first: { status: "ready", issues: ["blur", "identity_name"], guidance: "Foto A cukup jelas." }, second: { status: "attention", issues: ["face_covered", "low_light"], guidance: "Wajah pada foto B perlu lebih terlihat." }, notice: "Hanya pemeriksaan teknis." }));
    expect(result).toEqual({ overall: "attention", first: { status: "ready", issues: ["blur"], guidance: "Foto A cukup jelas." }, second: { status: "attention", issues: ["face_covered", "low_light"], guidance: "Wajah pada foto B perlu lebih terlihat." }, notice: "Hanya pemeriksaan teknis." });
  });

  it("menghasilkan fallback aman saat keluaran vision tidak valid", () => {
    const result = parseCollaborationFaceReadiness("bukan-json");
    expect(result.overall).toBe("unavailable");
    expect(result.notice).toContain("tidak menyimpan atau mengenali identitas");
  });
});
