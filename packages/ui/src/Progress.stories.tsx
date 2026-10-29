import type { Meta, StoryObj } from '@storybook/react-vite';
import { Progress } from './Progress.js';

const meta = {
  component: Progress,
  args: { current: 2, total: 3, label: 'Step 2 of 3' },
} satisfies Meta<typeof Progress>;
export default meta;

export const Midway: StoryObj<typeof meta> = {};
export const Last: StoryObj<typeof meta> = { args: { current: 3, label: 'Step 3 of 3' } };
