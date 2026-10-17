import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button.js';

const meta = { component: Button, args: { children: 'Save note' } } satisfies Meta<typeof Button>;
export default meta;

export const Primary: StoryObj<typeof meta> = {};
export const Disabled: StoryObj<typeof meta> = { args: { disabled: true } };
