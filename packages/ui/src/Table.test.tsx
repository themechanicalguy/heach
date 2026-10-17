import { render, screen } from '@testing-library/react';
import { Table } from './Table.js';
import { expectNoAxeViolations } from './test/axe.js';

const rows = [{ id: '1', name: 'Physiotherapy', price: '₹600' }];
const columns = [
  { key: 'name', header: 'Service', cell: (r: (typeof rows)[number]) => r.name },
  { key: 'price', header: 'Price', cell: (r: (typeof rows)[number]) => r.price },
];

describe('Table', () => {
  it('has a caption and column headers', () => {
    render(<Table caption="Services" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole('table', { name: 'Services' })).toBeTruthy();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  });

  it('UX-01.2 has no axe violations', async () => {
    const { container } = render(
      <Table caption="Services" columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    await expectNoAxeViolations(container);
  });
});
