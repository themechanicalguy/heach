import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';

/** The axe build already installed for the ui package's own checks (A11Y-01, TS). */
const AXE = fileURLToPath(
  new URL('../../../packages/ui/node_modules/axe-core/axe.min.js', import.meta.url),
);

interface Violation {
  id: string;
  impact: string | null;
  nodes: { target: string[] }[];
}

/**
 * WCAG 2.2 A and AA rules on the page as it is now (Step 10, A11Y-01). Automated checks only:
 * the screen-reader passes with TalkBack, VoiceOver and NVDA stay a manual audit.
 */
export async function expectAccessible(page: Page, screen: string): Promise<void> {
  await page.addScriptTag({ path: AXE });
  const violations = await page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (context: Document, options: object) => Promise<{ violations: Violation[] }> };
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    });
    return result.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    }));
  });
  expect(violations, `accessibility of ${screen}`).toEqual([]);
}
