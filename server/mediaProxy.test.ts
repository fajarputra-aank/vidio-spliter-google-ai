import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ storageGetSignedUrl: vi.fn(), authenticateRequest: vi.fn(), userOwnsPhotoMedia: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl }));
vi.mock("./db", () => ({ userOwnsPhotoMedia: mocks.userOwnsPhotoMedia }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));

import { registerMediaProxy } from "./_core/mediaProxy";

function response() { const result = { status: vi.fn(), send: vi.fn(), set: vi.fn(), redirect: vi.fn() }; result.status.mockReturnValue(result); return result; }

describe("media proxy", () => {
  const routes: Record<string, (req: never, res: never) => Promise<void>> = {};
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(routes).forEach((key) => delete routes[key]);
    registerMediaProxy({ get: vi.fn((path, handler) => { routes[path] = handler; }) } as never);
    mocks.storageGetSignedUrl.mockResolvedValue("https://cdn.example.test/signed-image");
  });

  it("serves approved system media through a signed URL and rejects unknown public keys", async () => {
    const success = response();
    await routes["/api/media/public/*"]({ params: { 0: "lensa-saku-headshot_83cca6e1.jpg" } } as never, success as never);
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("lensa-saku-headshot_83cca6e1.jpg");
    expect(success.redirect).toHaveBeenCalledWith(307, "https://cdn.example.test/signed-image");
    const missing = response();
    await routes["/api/media/public/*"]({ params: { 0: "not-allowed.jpg" } } as never, missing as never);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  it("requires the authenticated owner before signing private photo media", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 88, isCron: false });
    mocks.userOwnsPhotoMedia.mockResolvedValue(true);
    const success = response();
    await routes["/api/media/private/*"]({ params: { 0: "originals%2F88%2Fframe.jpg" } } as never, success as never);
    expect(mocks.userOwnsPhotoMedia).toHaveBeenCalledWith(88, "/manus-storage/originals/88/frame.jpg");
    expect(success.redirect).toHaveBeenCalledWith(307, "https://cdn.example.test/signed-image");
  });
});
