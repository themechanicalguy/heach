import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge.js';

const meta = { component: Badge, args: { children: 'Verified' } } satisfies Meta<typeof Badge>;
export default meta;

export const Success: StoryObj<typeof meta> = { args: { tone: 'success' } };
export const Waiting: StoryObj<typeof meta> = { args: { tone: 'warning', children: 'Pending' } };
export const Failed: StoryObj<typeof meta> = { args: { tone: 'danger', children: 'Failed' } };
export const Neutral: StoryObj<typeof meta> = { args: { children: 'Not started' } };
