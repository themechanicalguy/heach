import { render, screen } from '@testing-library/react';
import { BottomNav } from './BottomNav.js';
import { expectNoAxeViolations } from './test/axe.js';

const items = [
  { href: '/en', label: 'Home', current: true },
  { href: '/en/notes', label: 'Notes' },
];

describe('BottomNav', () => {
  it('is a labelled navigation landmark marking the current page', () => {
    render(<BottomNav label="Main" items={items} />);
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page');
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(<BottomNav label="Main" items={items} />);
    await expectNoAxeViolations(container);
  });
});
