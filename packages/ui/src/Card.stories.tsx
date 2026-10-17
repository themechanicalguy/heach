import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card.js';

const meta = {
  component: Card,
  args: { title: 'Home physiotherapy', children: 'Visits at home, 45 minutes.' },
} satisfies Meta<typeof Card>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
