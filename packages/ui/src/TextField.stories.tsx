import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField.js';

const meta = {
  component: TextField,
  args: { label: 'Full name', hint: 'As on your ID' },
} satisfies Meta<typeof TextField>;
export default meta;

export const Input: StoryObj<typeof meta> = {};
export const WithError: StoryObj<typeof meta> = {
  args: { error: 'Enter your name', defaultValue: 'A' },
};
export const Multiline: StoryObj<typeof meta> = {
  args: { multiline: true, label: 'New note', hint: 'Up to 2,000 characters.' },
};
export const Odia: StoryObj<typeof meta> = {
  args: { label: 'ନୂଆ ଟିପ୍ପଣୀ', hint: 'କେବଳ ଆପଣ ଏହା ପଢ଼ିପାରିବେ।' },
};
