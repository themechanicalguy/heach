import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon.js';

const meta = {
  component: Icon,
  args: { name: 'globe' },
} satisfies Meta<typeof Icon>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
