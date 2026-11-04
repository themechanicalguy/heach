import { mockBlobUrls } from '../../test/blob-urls';
import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expectNoAxeViolations } from '../../../../../packages/ui/src/test/axe';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../../lib/session', () => ({
  SessionProvider: ({ children }: { children: ReactNode }) => children,
  useSession: () => ({ status: 'signed-out' }),
}));
vi.mock('../../lib/account', () => ({
  AccountProvider: ({ children }: { children: ReactNode }) => children,
  useAccount: () => ({ enabled: false, account: { state: 'idle' } }),
}));
vi.mock('../../lib/use-resource', () => ({
  useResource: () => ({ resource: { state: 'ready', data: [] }, reload: () => Promise.resolve() }),
}));

type Stories = Record<string, { render?: () => ReactNode }>;
const modules = import.meta.glob<Stories>(
  [
    './*.stories.tsx',
    '../care/ProviderCard.stories.tsx',
    '../vault/*.stories.tsx',
    '../booking/*.stories.tsx',
    '../files/*.stories.tsx',
  ],
  { eager: true },
);
const stories = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([, story]) => typeof story.render === 'function')
    .map(([name, story]) => ({ file, name, render: story.render })),
);

beforeEach(mockBlobUrls);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Site stories in three languages', () => {
  it.each(stories)('$file $name passes axe', async ({ render: story }) => {
    const { container } = render(story?.());
    await act(async () => {
      await expectNoAxeViolations(container);
    });
  });
  it('covers all new site components', () => {
    expect(stories).toHaveLength(58);
  });
});
