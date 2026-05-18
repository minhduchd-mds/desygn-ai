import { test, expect } from "@playwright/test";

// Helper: register and enter workspace
async function enterWorkspace(page: import("@playwright/test").Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill("AuditPass123!");
  await page.getByRole("button", { name: /register|sign up|get started/i }).click();
  await expect(
    page.locator(".chat-workspace, .builder-workspace, .welcome-hero")
  ).toBeVisible({ timeout: 5000 });
}

test.describe("Audit Flow", () => {
  test.beforeEach(async ({ page }) => {
    await enterWorkspace(page, "audit-flow@example.com");
  });

  // ── 1. Navigate to audit page ────────────────────────────────────────────

  test("can navigate to audit page", async ({ page }) => {
    // The sidebar nav link for the checklist panel
    const checklistNav = page.locator('a[href="#checklist"]');
    await expect(checklistNav).toBeVisible();
    await checklistNav.click();

    // The checklist content panel should appear
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // Header reads "Checklist UI/UX"
    await expect(
      page.locator(".checklist-content-header h2")
    ).toContainText("Checklist UI/UX");
  });

  // ── 2. Displays audit criteria list ──────────────────────────────────────

  test("displays audit criteria list", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // The criteria table must render
    const table = page.locator(".checklist-table");
    await expect(table).toBeVisible();

    // Table has the expected column headers
    const headers = table.locator("thead th");
    await expect(headers).toHaveCount(8);
    await expect(headers.nth(0)).toContainText("STT");
    await expect(headers.nth(2)).toContainText("Tiêu chí");
    await expect(headers.nth(4)).toContainText("Trạng thái");

    // At least one data row should be present
    const allRows = table.locator("tbody tr");
    await expect(allRows).not.toHaveCount(0);
  });

  // ── 3. Score card renders ────────────────────────────────────────────────

  test("shows score card with category bars", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // SVG score circle
    await expect(page.locator(".checklist-score-card .score-circle svg")).toBeVisible();

    // Four category score bars: Visual Design, Typography, Accessibility, Interaction
    const bars = page.locator(".score-bar-row");
    await expect(bars).toHaveCount(4);
    await expect(bars.nth(0)).toContainText("Visual Design");
    await expect(bars.nth(1)).toContainText("Typography");
    await expect(bars.nth(2)).toContainText("Accessibility");
    await expect(bars.nth(3)).toContainText("Interaction");
  });

  // ── 4. Filter bar is functional ──────────────────────────────────────────

  test("can filter criteria by status tab", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // Filter tabs: all | ui | ux | pass | fail | warn
    const tabs = page.locator(".checklist-filter-tabs [role=tab]");
    await expect(tabs).toHaveCount(6);

    // Click the "Fail" tab
    await tabs.filter({ hasText: "Fail" }).click();
    await expect(tabs.filter({ hasText: "Fail" })).toHaveAttribute("aria-selected", "true");
  });

  test("can search criteria by keyword", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const searchInput = page.locator(".checklist-search-input");
    await expect(searchInput).toBeVisible();

    // Type a term unlikely to match every row
    await searchInput.fill("contrast");

    // Either rows appear matching the keyword, or the empty-state message is shown
    const emptyState = page.locator(".checklist-empty");
    const rows = page.locator(".checklist-table tbody tr");
    const hasRows = await rows.count() > 0;
    const isEmpty = await emptyState.isVisible();
    expect(hasRows || isEmpty).toBeTruthy();
  });

  test("can filter by category dropdown", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const dropdown = page.locator(".checklist-cat-dropdown").first();
    await expect(dropdown).toBeVisible();

    // Change to any non-default option
    await dropdown.selectOption({ index: 1 });

    // Table should still render (even if empty)
    await expect(page.locator(".checklist-table")).toBeVisible();
  });

  // ── 5. Update a criterion status ────────────────────────────────────────

  test("can change a criterion status to Pass", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // Get first status select in the table body
    const firstStatusSelect = page
      .locator(".checklist-table tbody .status-select")
      .first();
    await expect(firstStatusSelect).toBeVisible();

    // Set to pass
    await firstStatusSelect.selectOption("pass");
    await expect(firstStatusSelect).toHaveValue("pass");
  });

  test("can set a criterion score value", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const firstScoreInput = page
      .locator(".checklist-table tbody .score-input")
      .first();
    await expect(firstScoreInput).toBeVisible();

    await firstScoreInput.triple_click();
    await firstScoreInput.fill("8");
    await firstScoreInput.press("Tab");
    await expect(firstScoreInput).toHaveValue("8");
  });

  // ── 6. Detail panel ──────────────────────────────────────────────────────

  test("opens detail panel when clicking Chi tiết button", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const detailBtn = page.locator(".btn-detail").first();
    await expect(detailBtn).toBeVisible();
    await detailBtn.click();

    // A modal/dialog should appear
    await expect(
      page.locator('[role="dialog"]')
    ).toBeVisible({ timeout: 3000 });
  });

  // ── 7. Export report flow ────────────────────────────────────────────────

  test("can open the export report modal", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    // "Xuất báo cáo" button is in the checklist header
    const exportBtn = page.locator(
      '.checklist-content-header button:has-text("Xuất báo cáo")'
    );
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // Report modal opens
    await expect(
      page.locator('[role="dialog"]:has-text("Báo cáo UI/UX Review")')
    ).toBeVisible({ timeout: 3000 });
  });

  test("export report modal shows summary metrics", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    await page
      .locator('.checklist-content-header button:has-text("Xuất báo cáo")')
      .click();

    const modal = page.locator('[role="dialog"]:has-text("Báo cáo UI/UX Review")');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Metrics: Điểm tổng, Pass, Fail, Warn, Chưa test
    const metrics = modal.locator(".report-metric");
    await expect(metrics).not.toHaveCount(0);
    await expect(modal.locator(".report-metric-label")).toContainText(["Pass", "Fail", "Warn"]);
  });

  test("export report modal has CSV and PDF export buttons", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    await page
      .locator('.checklist-content-header button:has-text("Xuất báo cáo")')
      .click();

    const modal = page.locator('[role="dialog"]:has-text("Báo cáo UI/UX Review")');
    await expect(modal).toBeVisible({ timeout: 3000 });

    await expect(modal.locator("button:has-text('Xuất CSV')")).toBeVisible();
    await expect(modal.locator("button:has-text('Xuất PDF')")).toBeVisible();
  });

  test("closing export report modal returns to checklist panel", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    await page
      .locator('.checklist-content-header button:has-text("Xuất báo cáo")')
      .click();

    const modal = page.locator('[role="dialog"]:has-text("Báo cáo UI/UX Review")');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Close via the × button inside the modal
    await modal.locator(".template-popup-close").click();
    await expect(modal).not.toBeVisible({ timeout: 3000 });
    await expect(page.locator(".checklist-content-panel")).toBeVisible();
  });

  // ── 8. Pagination ────────────────────────────────────────────────────────

  test("pagination controls are visible and functional", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const pagination = page.locator(".checklist-pagination");
    await expect(pagination).toBeVisible();

    // Next page button (›)
    const nextBtn = pagination.locator("button").filter({ hasText: "›" });
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      // After navigation, the active page button should update
      const activePageBtn = pagination.locator("button.active");
      await expect(activePageBtn).toContainText("2");
    }
  });

  // ── 9. Setup data source modal ───────────────────────────────────────────

  test("can open the data source setup modal", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    const setupBtn = page.locator(
      '.checklist-content-header button:has-text("Cài đặt nguồn dữ liệu")'
    );
    await expect(setupBtn).toBeVisible();
    await setupBtn.click();

    await expect(page.locator(".setup-modal")).toBeVisible({ timeout: 3000 });
    await expect(
      page.locator('.setup-modal-header h3')
    ).toContainText("Cài đặt kết nối");
  });

  test("setup modal has three tab options", async ({ page }) => {
    await page.locator('a[href="#checklist"]').click();
    await expect(page.locator(".checklist-content-panel")).toBeVisible({ timeout: 3000 });

    await page
      .locator('.checklist-content-header button:has-text("Cài đặt nguồn dữ liệu")')
      .click();

    const modal = page.locator(".setup-modal");
    await expect(modal).toBeVisible({ timeout: 3000 });

    const tabs = modal.locator(".setup-mtabs button");
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toContainText("Nguồn dữ liệu");
    await expect(tabs.nth(1)).toContainText("Tiêu chí Checklist");
    await expect(tabs.nth(2)).toContainText("Kết nối MCP/Tools");
  });
});
