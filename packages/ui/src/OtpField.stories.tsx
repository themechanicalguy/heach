import type { Meta, StoryObj } from '@storybook/react-vite';
import { OtpField } from './OtpField.js';

const meta = { component: OtpField, args: { label: 'One-time password' } } satisfies Meta<
  typeof OtpField
>;
export default meta;

export const Empty: StoryObj<typeof meta> = {};
export const WrongCode: StoryObj<typeof meta> = {
  args: { defaultValue: '123456', error: 'That code did not match' },
};
