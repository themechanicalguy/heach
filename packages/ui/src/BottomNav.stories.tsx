import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomNav } from './BottomNav.js';

const meta = {
  component: BottomNav,
  args: {
    label: 'Main',
    items: [
      { href: '#home', label: 'Home', current: true },
      { href: '#notes', label: 'Notes' },
      { href: '#account', label: 'Account' },
    ],
  },
} satisfies Meta<typeof BottomNav>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
