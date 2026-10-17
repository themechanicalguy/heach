import axe from 'axe-core';

/**
 * Runs axe on rendered markup and fails with the rule IDs (TS-02.1, UX-01.2). Colour contrast
 * needs real layout, which jsdom lacks; Lighthouse and Storybook check it in a browser.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}
