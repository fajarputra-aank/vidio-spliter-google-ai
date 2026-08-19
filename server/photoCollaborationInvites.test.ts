import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createPhotoCollaborationInvite: vi.fn(), listPhotoCollaborationInvites: vi.fn(), respondPhotoCollaborationInvite: vi.fn() }));
vi.mock("./db", () => ({ createPhotoCollaborationInvite: mocks.createPhotoCollaborationInvite, listPhotoCollaborationInvites: mocks.listPhotoCollaborationInvites, respondPhotoCollaborationInvite: mocks.respondPhotoCollaborationInvite }));
import { appRouter } from "./routers";

function context(userId: number): TrpcContext { return { user: { id: userId, openId: `invite-${userId}`, name: "Pemilik", email: `pemilik${userId}@example.test`, loginMethod: "local", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {}, protocol: "https" } as TrpcContext["req"], res: {} as TrpcContext["res"] }; }

describe("undangan Kolaborasi Foto", () => {
  it("membuat undangan dengan email ternormalisasi dan konfigurasi yang akan disetujui", async () => {
    mocks.createPhotoCollaborationInvite.mockResolvedValue({ id: 7, status: "pending" });
    await appRouter.createCaller(context(51)).photo.inviteToCollaboration({ email: " REKAN@EXAMPLE.TEST ", template: "couple", aspectRatio: "1:1", style: "editorial", note: "Mari setujui dulu." });
    expect(mocks.createPhotoCollaborationInvite).toHaveBeenCalledWith(51, "rekan@example.test", { email: "REKAN@EXAMPLE.TEST", template: "couple", aspectRatio: "1:1", style: "editorial", note: "Mari setujui dulu." });
  });

  it("membaca dan merespons undangan hanya dengan identitas penerima aktif", async () => {
    mocks.listPhotoCollaborationInvites.mockResolvedValue({ incoming: [], outgoing: [] }); mocks.respondPhotoCollaborationInvite.mockResolvedValue({ success: true, status: "accepted" });
    const caller = appRouter.createCaller(context(52)); await caller.photo.collaborationInvites(); await caller.photo.respondToCollaborationInvite({ inviteId: 11, action: "accepted" });
    expect(mocks.listPhotoCollaborationInvites).toHaveBeenCalledWith(52); expect(mocks.respondPhotoCollaborationInvite).toHaveBeenCalledWith(52, 11, "accepted");
  });
});
