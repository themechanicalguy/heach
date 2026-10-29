import type { Meta, StoryObj } from '@storybook/react-vite';
import { Notice } from './Notice.js';

const meta = {
  component: Notice,
  args: { children: 'Your details are encrypted. Every view is logged.' },
} satisfies Meta<typeof Notice>;
export default meta;

export const Info: StoryObj<typeof meta> = {};
export const Warning: StoryObj<typeof meta> = { args: { tone: 'warning', live: true } };
