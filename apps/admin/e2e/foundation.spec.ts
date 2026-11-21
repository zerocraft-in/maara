import { expect, test } from "@playwright/test";

/**
 * Phase 1 smoke test. It asserts only what actually exists: the foundation
 * status page, the theme control and the documented blocker. Business
 * workflows are added with the phases that implement them.
 */
test.describe("foundation page", () => {
  test("renders the real project state", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /the admin foundation is in place/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText("Phase 1 · Foundation", { exact: true }),
    ).toBeAttached();

    await expect(
      page.getByText(/Docker Desktop is not installed/i),
    ).toBeVisible();

    await expect(page.getByText("Not built yet")).toBeVisible();
  });

  test("switches and persists the theme", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.getByRole("button", { name: "Light theme" }).click();
    await expect(page.locator("html")).toHaveClass(/light/);

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/light/);
  });

  test("has no horizontal overflow on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );

    expect(overflow).toBe(false);
  });
});
