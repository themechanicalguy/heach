import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from './States.js';
import { expectNoAxeViolations } from './test/axe.js';

describe('State components (UX-04.1)', () => {
  it('UX-04.1 loading, empty, error and offline states render with the right roles', () => {
    const onRetry = vi.fn();
    render(
      <>
        <Skeleton label="Loading" />
        <EmptyState message="No notes yet" />
        <ErrorState message="Something went wrong" retryLabel="Try again" onRetry={onRetry} />
        <OfflineBanner message="You are offline" />
      </>,
    );
    expect(screen.getAllByRole('status').map((el) => el.textContent)).toEqual([
      'Loading',
      'No notes yet',
      'You are offline',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(
      <>
        <Skeleton label="Loading" />
        <EmptyState message="No notes yet" />
        <ErrorState message="Something went wrong" retryLabel="Try again" onRetry={vi.fn()} />
        <OfflineBanner message="You are offline" />
      </>,
    );
    await expectNoAxeViolations(container);
  });
});
