import type { MatrixSnapshot } from "../../algorithms/types";
import styles from './MatrixTable.module.css';

/** A table of values. The pivot row and column are tinted; the focused cell glows. */
export function MatrixTable({ matrix }: { matrix: MatrixSnapshot }) {
  const { focus, pivot } = matrix;

  return (
    <div className={styles.matrixScroll}>
      <table className={styles.matrix}>

        <thead>
          <tr>
            <td />
            {matrix.columnLabels.map((columnLabel, column) => (
              <th key={columnLabel} scope="col" data-pivot={column === pivot}>
                {columnLabel}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {matrix.rows.map((row, rowIndex) => (
            <tr key={row.label}>
              <th scope="row" data-pivot={rowIndex === pivot}>
                {row.label}
              </th>
              {row.cells.map((cell, column) => {
                const isFocus = focus?.row === rowIndex && focus.column === column;
                return (
                  <td key={matrix.columnLabels[column]}
                      data-pivot={rowIndex === pivot || column === pivot}
                      data-focus={isFocus ? (focus.updated ? 'updated' : 'checked') : undefined}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}