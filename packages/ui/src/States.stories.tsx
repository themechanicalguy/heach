import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState, ErrorState, OfflineBanner, Skeleton } from './States.js';

const meta = { title: 'States', component: Skeleton, args: { label: 'Loading' } } satisfies Meta<
  typeof Skeleton
>;
export default meta;

export const Loading: StoryObj<typeof meta> = {};
export const Empty: StoryObj<typeof meta> = { render: () => <EmptyState message="No notes yet" /> };
export const Failed: StoryObj<typeof meta> = {
  render: () => (
    <ErrorState message="Something went wrong." retryLabel="Try again" onRetry={() => undefined} />
  ),
};
export const Offline: StoryObj<typeof meta> = {
  render: () => <OfflineBanner message="You are offline." />,
};
