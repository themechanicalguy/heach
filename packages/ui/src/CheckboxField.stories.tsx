import type { Meta, StoryObj } from '@storybook/react-vite';
import { CheckboxField } from './CheckboxField.js';

const meta = {
  component: CheckboxField,
  args: { label: 'I am 18 years or older' },
} satisfies Meta<typeof CheckboxField>;
export default meta;

export const Unchecked: StoryObj<typeof meta> = {};
export const WithError: StoryObj<typeof meta> = { args: { error: 'Please confirm' } };
