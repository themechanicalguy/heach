import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toast } from './Toast.js';

const meta = { component: Toast, args: { message: 'Note saved', tone: 'success' } } satisfies Meta<
  typeof Toast
>;
export default meta;

export const Success: StoryObj<typeof meta> = {};
export const Failure: StoryObj<typeof meta> = {
  args: { message: 'Could not save', tone: 'error' },
};
export const Dismissible: StoryObj<typeof meta> = {
  args: { dismissLabel: 'Close', onDismiss: () => undefined },
};
