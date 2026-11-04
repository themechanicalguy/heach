import { render, screen } from '@testing-library/react';
import { Badge } from './Badge.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('Badge', () => {
  it('shows its text with the tone as a class, never as the only signal', () => {
    render(<Badge tone="danger">Failed</Badge>);
    const badge = screen.getByText('Failed');
    expect(badge.className).toContain('heach-badge--danger');
  });

  it('UX-01.2 has no axe violations in every tone', async () => {
    const { container } = render(
      <p>
        <Badge tone="success">Verified</Badge> <Badge tone="warning">Pending</Badge>{' '}
        <Badge tone="danger">Failed</Badge> <Badge tone="info">Submitted</Badge>{' '}
        <Badge>Not started</Badge>
      </p>,
    );
    await expectNoAxeViolations(container);
  });
});
