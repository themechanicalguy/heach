import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sheet } from './Sheet.js';

const meta = {
  component: Sheet,
  args: {
    open: true,
    title: 'Choose a language',
    closeLabel: 'Close',
    onClose: () => undefined,
    children: 'ଓଡ଼ିଆ · English · हिन्दी',
  },
} satisfies Meta<typeof Sheet>;
export default meta;

export const Open: StoryObj<typeof meta> = {};
