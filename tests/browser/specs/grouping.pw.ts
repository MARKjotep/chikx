import { COLOR_SCHEMES, SCENARIOS, VIEWPORTS } from "../harness/scenarios";
import { expect, open, readScenario, skipBrowserIfMissing, test } from "./support";

skipBrowserIfMissing();

/**
 * Masterplan §9: safe media grouping must not change computed styles. Each
 * scenario is compiled with `mediaGrouping: "safe"` (default) and
 * `mediaGrouping: "none"`; the resulting pages must be computed-style equal at
 * every required viewport and color scheme.
 */
test.describe("safe grouping vs no grouping parity", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const scenario of SCENARIOS) {
    test(`${scenario.name}: safe grouping preserves computed styles`, async ({ page }) => {
      for (const width of VIEWPORTS) {
        for (const scheme of COLOR_SCHEMES) {
          await open(page, scenario.name, "pretty", { width, scheme });
          const safe = await readScenario(page, scenario);

          await open(page, scenario.name, "nogroup", { width, scheme });
          const ungrouped = await readScenario(page, scenario);

          expect(ungrouped, `${scenario.name} grouping at ${width}px in ${scheme}`).toEqual(safe);
        }
      }
    });
  }
});
