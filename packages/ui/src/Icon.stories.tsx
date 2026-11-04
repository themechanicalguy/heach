import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon.js';

const meta = {
  component: Icon,
  args: { name: 'globe' },
} satisfies Meta<typeof Icon>;
export default meta;

export const Default: StoryObj<typeof meta> = {};

export const CareServices: StoryObj<typeof meta> = {
  render: () => (
    <div>
      <Icon name="physiotherapy" />
      <Icon name="nurse" />
      <Icon name="attendant" />
      <Icon name="lab" />
    </div>
  ),
};

export const Contact: StoryObj<typeof meta> = {
  render: () => (
    <div>
      <Icon name="calendar" />
      <Icon name="shield" />
      <Icon name="wallet" />
      <Icon name="lock" />
      <Icon name="message" />
      <Icon name="phone" />
      <Icon name="mail" />
    </div>
  ),
};
