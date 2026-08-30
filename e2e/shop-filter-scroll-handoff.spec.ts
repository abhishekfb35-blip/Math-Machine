import { test, expect, type Page } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 400, height: 720 },
] as const;

type HandoffState = {
  controlsVisible: boolean;
  summaryVisible: boolean;
};

async function getAudienceFilterId(page: Page): Promise<string> {
  const response = await page.request.get("/api/attributes");
  expect(response.ok()).toBeTruthy();

  const attributes = await response.json();
  const audience = attributes?.audience?.find(
    (option: { id?: string; name?: string }) => option.name === "kids",
  ) ?? attributes?.audience?.[0];

  expect(audience?.id, "Expected at least one audience filter").toBeTruthy();
  return audience.id;
}

async function sampleHandoff(
  page: Page,
  scrollY: number,
): Promise<HandoffState[]> {
  return page.evaluate(async (targetY) => {
    const controls = document.querySelector<HTMLElement>(
      '[data-testid="shop-filter-controls"]',
    );
    const summary = document.querySelector<HTMLElement>(
      '[data-testid="shop-active-filter-summary"]',
    );
    if (!controls || !summary) {
      throw new Error("Shop filter handoff regions were not rendered");
    }

    window.scrollTo(0, targetY);

    const states: HandoffState[] = [];
    const startedAt = performance.now();
    while (performance.now() - startedAt < 450) {
      states.push({
        controlsVisible: !controls.classList.contains("hidden"),
        summaryVisible: getComputedStyle(summary).display !== "none",
      });
      await new Promise<void>(resolve => setTimeout(resolve, 16));
    }
    return states;
  }, scrollY);
}

function countTransitions(values: boolean[]): number {
  return values.slice(1).reduce(
    (count, value, index) => count + (value === values[index] ? 0 : 1),
    0,
  );
}

for (const viewport of viewports) {
  test.describe(`Shop filter scroll handoff — ${viewport.name}`, () => {
    test.use({ viewport });

    test("collapses and restores without flicker", async ({ page }) => {
      const filterId = await getAudienceFilterId(page);
      await page.goto(`/shop?filter=${encodeURIComponent(filterId)}`);

      const controls = page.getByTestId("shop-filter-controls");
      const summary = page.getByTestId("shop-active-filter-summary");
      await expect(page.getByTestId(`filter-${filterId}`)).toBeVisible({
        timeout: 10000,
      });
      await expect(controls).toBeVisible();
      await expect(summary).toHaveCount(1);
      await expect(summary).toBeHidden();

      const collapsed = await sampleHandoff(page, 180);
      expect(
        countTransitions(collapsed.map(state => state.controlsVisible)),
        "Full filter controls should collapse in one transition",
      ).toBe(1);
      expect(collapsed.at(-1)?.controlsVisible).toBe(false);

      if (viewport.width >= 640) {
        expect(
          countTransitions(collapsed.map(state => state.summaryVisible)),
          "Active-filter summary should appear in one transition",
        ).toBe(1);
        expect(collapsed.at(-1)?.summaryVisible).toBe(true);
      } else {
        expect(collapsed.every(state => !state.summaryVisible)).toBe(true);
      }

      const restored = await sampleHandoff(page, 0);
      expect(
        countTransitions(restored.map(state => state.controlsVisible)),
        "Full filter controls should restore in one transition",
      ).toBe(1);
      expect(restored.at(-1)?.controlsVisible).toBe(true);
      expect(
        countTransitions(restored.map(state => state.summaryVisible)),
        "Active-filter summary should hide in one transition",
      ).toBe(viewport.width >= 640 ? 1 : 0);
      expect(restored.at(-1)?.summaryVisible).toBe(false);
    });
  });
}