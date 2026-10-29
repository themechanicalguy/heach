import type { Meta, StoryObj } from '@storybook/react-vite';
import { BottomNav } from './BottomNav.js';
import { Icon } from './Icon.js';

const meta = {
  component: BottomNav,
  args: {
    label: 'Main',
    items: [
      { href: '#home', label: 'Home', icon: <Icon name="home" />, current: true },
      { href: '#notes', label: 'Notes', icon: <Icon name="note" /> },
      { href: '#account', label: 'Account', icon: <Icon name="user" /> },
    ],
  },
} satisfies Meta<typeof BottomNav>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
