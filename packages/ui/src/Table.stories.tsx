import type { Meta, StoryObj } from '@storybook/react-vite';
import { Table } from './Table.js';

interface Row {
  id: string;
  service: string;
  price: string;
}

const rows: Row[] = [
  { id: '1', service: 'Home physiotherapy', price: '₹600' },
  { id: '2', service: 'Bedside attendant (12 h)', price: '₹1,200' },
];

const meta = {
  component: Table<Row>,
  args: {
    caption: 'Services',
    rows,
    rowKey: (row: Row) => row.id,
    columns: [
      { key: 'service', header: 'Service', cell: (row: Row) => row.service },
      { key: 'price', header: 'Price', cell: (row: Row) => row.price },
    ],
  },
} satisfies Meta<typeof Table<Row>>;
export default meta;

export const Default: StoryObj<typeof meta> = {};
