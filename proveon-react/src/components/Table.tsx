type TableProps<T> = {
  columns: { header: string; accessor: keyof T }[];
  data: T[];
};

function Table<T extends Record<string, any>>({ columns, data }: TableProps<T>) {
  const renderCell = (col: { header: string; accessor: keyof T }, row: T) => {
    const value = row[col.accessor];

    // Status pill rendering
    if (col.accessor === 'status') {
      const statusClass =
        value === 'Active' || value === 'Completed' || value === 'Confirmed'
          ? 'status-pill active'
          : value === 'Pending' || value === 'Trial'
          ? 'status-pill pending'
          : 'status-pill suspended';

      return <span className={statusClass}>{value}</span>;
    }

    // Plan badge rendering
    if (col.accessor === 'plan') {
      return <span className="plan-tag">{value}</span>;
    }

    return value;
  };

  return (
    <div className="dash-table-responsive">
      <table className="dash-data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={String(col.accessor)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={String(col.accessor)}>
                  {renderCell(col, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
