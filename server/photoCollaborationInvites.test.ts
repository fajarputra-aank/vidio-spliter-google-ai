import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ createPhotoCollaborationInvite: vi.fn(), listPhotoCollaborationInvites: vi.fn(), respondPhotoCollaborationInvite: vi.fn(), cancelPhotoCollaborationInvite: vi.fn(), listPhotoCollaborationProjects: vi.fn() }));
vi.mock("./db", () => ({ createPhotoCollaborationInvite: mocks.createPhotoCollaborationInvite, listPhotoCollaborationInvites: mocks.listPhotoCollaborationInvites, respondPhotoCollaborationInvite: mocks.respondPhotoCollaborationInvite, cancelPhotoCollaborationInvite: mocks.cancelPhotoCollaborationInvite, listPhotoCollaborationProjects: mocks.listPhotoCollaborationProjects }));
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

  it("membatalkan undangan dan membaca riwayat proyek hanya untuk pemilik aktif", async () => {
    mocks.cancelPhotoCollaborationInvite.mockResolvedValue({ success: true }); mocks.listPhotoCollaborationProjects.mockResolvedValue([{ id: 61, resultUrl: "/manus-storage/results/collaboration.jpg" }]);
    const caller = appRouter.createCaller(context(53)); await caller.photo.cancelCollaborationInvite({ inviteId: 18 }); const projects = await caller.photo.collaborationProjects();
    expect(mocks.cancelPhotoCollaborationInvite).toHaveBeenCalledWith(53, 18); expect(mocks.listPhotoCollaborationProjects).toHaveBeenCalledWith(53); expect(projects[0]).toMatchObject({ id: 61, resultUrl: "/api/media/private/results%2Fcollaboration.jpg" });
  });
});
