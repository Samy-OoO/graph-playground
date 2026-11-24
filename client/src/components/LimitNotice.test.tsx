// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS } from '@graph-playground/shared';
import { LimitNotice } from './LimitNotice';

afterEach(cleanup);

describe('LimitNotice', () => {
  it('says nothing while the graph is below the limits', () => {
    const { container } = render(<LimitNotice nodeCount={LIMITS.maxNodes - 1} edgeCount={LIMITS.maxEdges - 1} />);
    expect(container.textContent).toBe('');
  });

  it('explains when the edge limit is reached', () => {
    render(<LimitNotice nodeCount={10} edgeCount={LIMITS.maxEdges} />);
    expect(screen.getByRole('status').textContent).toContain(`${LIMITS.maxEdges} edges`);
  });

  it('explains when the node limit is reached', () => {
    render(<LimitNotice nodeCount={LIMITS.maxNodes} edgeCount={0} />);
    expect(screen.getByRole('status').textContent).toContain(`${LIMITS.maxNodes} nodes`);
  });
});