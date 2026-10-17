import type { ReactNode } from 'react';

export interface TableColumn<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  /** Required: names the table for screen readers. */
  caption: string;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
}

/** Data table with a caption and column headers; scrolls sideways inside itself on phones. */
export function Table<Row>({ caption, columns, rows, rowKey }: Readonly<TableProps<Row>>) {
  return (
    <div className="heach-table-wrap">
      <table className="heach-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key}>{column.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
