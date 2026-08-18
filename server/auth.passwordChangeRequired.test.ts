import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextWithTemporaryPassword(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "legacy-admin",
      name: "Administrator",
      email: "admin@example.com",
      loginMethod: "password",
      passwordHash: "scrypt$placeholder$placeholder",
      mustChangePassword: true,
      role: "admin",
      unlimitedTransforms: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("temporary-password access guard", () => {
  it("blocks both private studio data and administrator operations until a password is changed", async () => {
    const caller = appRouter.createCaller(contextWithTemporaryPassword());
    await expect(caller.photo.list()).rejects.toMatchObject({ code: "FORBIDDEN", message: "Ganti kata sandi sementara sebelum memakai studio." });
    await expect(caller.admin.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
