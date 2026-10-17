import { fireEvent, render, screen } from '@testing-library/react';
import { expectNoAxeViolations } from './test/axe.js';
import { Toast } from './Toast.js';

describe('Toast', () => {
  it('announces politely, errors at once, and can be dismissed', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Saved" tone="success" dismissLabel="Close" onDismiss={onDismiss} />);
    expect(screen.getByRole('status').textContent).toContain('Saved');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledOnce();
    render(<Toast message="Failed" tone="error" />);
    expect(screen.getByRole('alert').textContent).toBe('Failed');
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(
      <Toast message="Saved" dismissLabel="Close" onDismiss={vi.fn()} />,
    );
    await expectNoAxeViolations(container);
  });
});
