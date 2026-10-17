import { render, screen } from '@testing-library/react';
import { Card } from './Card.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('Card', () => {
  it('renders a titled section', () => {
    render(<Card title="Today">Body</Card>);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(<Card title="Today">Body</Card>);
    await expectNoAxeViolations(container);
  });
});
