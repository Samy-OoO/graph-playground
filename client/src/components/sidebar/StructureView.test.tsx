// src/components/sidebar/StructureView.test.tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StructureView } from './StructureView';

afterEach(cleanup);

describe('StructureView', () => {
  it('renders a matrix with its row and column labels and values', () => {
    render(
      <StructureView
        structure={{
          title: 'Shortest distances',
          kind: 'matrix',
          items: [],
          matrix: {
            columnLabels: ['A', 'B'],
            rows: [
              { label: 'A', cells: ['0', '4'] },
              { label: 'B', cells: ['∞', '0'] },
            ],
            pivot: 1,
            focus: { row: 0, column: 1, updated: true },
          },
        }}
      />,
    );

    expect(screen.getByText('Shortest distances')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('4').getAttribute('data-focus')).toBe('updated');
    expect(screen.getByText('∞')).toBeTruthy();
  });

  it('shows a queue and a table together', () => {
    render(
      <StructureView
        structure={{
          title: 'Ready queue',
          kind: 'queue',
          items: ['B', 'C'],
          matrix: {
            columnLabels: ['In-degree', 'Order'],
            rows: [{ label: 'B', cells: ['0', '–'] }],
          },
        }}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('renders a stack that repeats a node without duplicate-key warnings', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<StructureView structure={{ title: 'Walk stack', kind: 'stack', items: ['A', 'B', 'C', 'A'] }} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});