import { fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('Sheet', () => {
  it('is a dialog labelled by its title with a close button', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Filters" closeLabel="Close" onClose={onClose}>
        Body
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close', hidden: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(
      <Sheet open title="Filters" closeLabel="Close" onClose={vi.fn()}>
        Body
      </Sheet>,
    );
    await expectNoAxeViolations(container);
  });
});
