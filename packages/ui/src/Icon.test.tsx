import { render } from '@testing-library/react';
import { Icon, ICON_NAMES } from './Icon.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('Icon', () => {
  it.each(ICON_NAMES)('draws %s hidden from assistive technology', (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('UX-01.2 has no axe violations beside its text', async () => {
    const { container } = render(
      <button type="button">
        <Icon name="globe" /> English
      </button>,
    );
    await expectNoAxeViolations(container);
  });
});
