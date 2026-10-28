import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChoiceGroup } from './ChoiceGroup.js';

const choices = [
  { value: 'patient', label: 'Get care for myself', hint: 'Book doctors, nurses and tests' },
  { value: 'nurse', label: 'I am a nurse', hint: 'Offer home visits' },
];

const meta = {
  component: ChoiceGroup,
  args: {
    legend: 'How will you use the app?',
    choices,
    value: 'patient',
    onChange: () => undefined,
  },
} satisfies Meta<typeof ChoiceGroup>;
export default meta;

export const Single: StoryObj<typeof meta> = {};
export const Several: StoryObj<typeof meta> = {
  args: { multiple: true, value: ['patient', 'nurse'], legend: 'Languages you speak' },
};
export const WithError: StoryObj<typeof meta> = { args: { value: '', error: 'Choose one' } };
