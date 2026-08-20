import { expect, test } from "@playwright/test";

test("menampilkan Coba lagi hanya untuk fallback tRPC sementara dan memulihkan halaman masuk", async ({ page }) => {
  let authMeRequests = 0;
  await page.route("**/api/trpc/**", async (route) => {
    const requestUrl = route.request().url();
    if (!requestUrl.includes("auth.me")) return route.continue();
    authMeRequests += 1;
    if (authMeRequests <= 4) {
      return route.fulfill({ status: 503, contentType: "text/html", body: "<html><body>sementara</body></html>" });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ result: { data: { json: null } } }]) });
  });

  await page.goto("/masuk?next=%2Fkolaborasi");
  await expect(page.getByRole("heading", { name: "Selamat datang kembali." })).toBeVisible();
  await expect(page.getByTestId("auth-api-retry")).toBeVisible();
  await expect(page.getByTestId("auth-api-retry-button")).toHaveText("Coba lagi");
  expect(authMeRequests).toBeGreaterThanOrEqual(4);

  await page.getByTestId("auth-api-retry-button").click();
  await expect(page.getByTestId("auth-api-retry")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Selamat datang kembali." })).toBeVisible();
  expect(authMeRequests).toBeGreaterThan(4);
});
