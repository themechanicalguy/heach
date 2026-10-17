import { composeStories } from '@storybook/react-vite';
import { cleanup, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { expectNoAxeViolations } from './test/axe.js';

type StoryModule = Parameters<typeof composeStories>[0];
const modules = import.meta.glob<StoryModule>('./*.stories.tsx', { eager: true });

const stories = Object.entries(modules).flatMap(([file, module]) =>
  Object.entries(composeStories(module)).map(
    // Composed stories render with their args, so no props are needed here.
    ([name, Story]) => [`${file} ${name}`, Story as ComponentType] as const,
  ),
);

describe('Storybook stories', () => {
  afterEach(cleanup);

  it('UX-01.1 cover every component file', () => {
    expect(stories.length).toBeGreaterThanOrEqual(15);
  });

  it.each(stories)('UX-01.2 %s passes axe', async (_name, Story) => {
    const { container } = render(<Story />);
    await expectNoAxeViolations(container);
  });
});
