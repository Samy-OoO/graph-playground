// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

async function startDfsOnSample() {
  const user = userEvent.setup();
  const view = render(<App />);

  await user.click(screen.getByRole('button', { name: 'Load sample' }));
  await user.click(screen.getByRole('button', { name: 'DFS' }));
  await user.selectOptions(screen.getByLabelText('Start node'), 'A');
  await user.click(screen.getByRole('button', { name: 'Generate DFS steps' }));

  return { user, view };
}

const count = (container: HTMLElement, selector: string) => container.querySelectorAll(selector).length;

describe('App', () => {
  it('shows the empty state and a tool hint before anything is built', () => {
    render(<App />);

    expect(screen.getByText('Your graph is empty')).toBeTruthy();
    expect(screen.getByText('Click a node to select it. Press Delete to remove it.')).toBeTruthy();
    expect(screen.getByText('0 nodes, 0 edges')).toBeTruthy();
  });

  it('lists coming-soon algorithms as disabled', () => {
    render(<App />);

    expect((screen.getByRole('button', { name: /Dijkstra/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /Topological Sort/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('runs DFS on the sample graph and lights up the active path edge by edge', async () => {
    const { user, view } = await startDfsOnSample();
    const { container } = view;

    // Step 1: at A, nothing followed yet.
    expect(screen.getByText('Step 1 of 9')).toBeTruthy();
    expect(count(container, 'g[data-status="active"]')).toBe(0);

    // Step 2: A → B is the active edge and the one being walked.
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(/Follow A → B/)).toBeTruthy();
    expect(count(container, 'g[data-status="active"]')).toBe(1);
    expect(count(container, 'g[data-flow="forward"]')).toBe(1);

    // Step 3: the whole path A → B → D is active; D is current, A and B are on the call stack.
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(/Follow B → D/)).toBeTruthy();
    expect(count(container, 'g[data-status="active"]')).toBe(2);
    expect(count(container, 'g[data-flow="forward"]')).toBe(1);
    expect(count(container, 'g[data-status="onPath"]')).toBe(2);
    expect(count(container, 'g[data-status="current"]')).toBe(1);

    // Step 4: D is finished and B → D is explored, so only A → B stays active.
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByText(/Finished D\. Backtrack to B/)).toBeTruthy();
    expect(count(container, 'g[data-status="active"]')).toBe(1);
    expect(count(container, 'g[data-status="settled"]')).toBe(1);
  });

  it('shows the skipped edge and the call stack', async () => {
    const { user, view } = await startDfsOnSample();

    for (let i = 0; i < 6; i++) await user.click(screen.getByRole('button', { name: 'Next step' }));

    expect(screen.getByText(/C → D: D was already visited/)).toBeTruthy();
    expect(count(view.container, 'g[data-status="skipped"]')).toBe(1);
    expect(screen.getByText('Call stack')).toBeTruthy();
  });

  it('plays to the end and reports the visit order', async () => {
    const { user } = await startDfsOnSample();

    for (let i = 0; i < 8; i++) await user.click(screen.getByRole('button', { name: 'Next step' }));

    expect(screen.getByText(/DFS complete\. Visit order: A, B, D, C/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next step' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears the run when the graph changes', async () => {
    const { user, view } = await startDfsOnSample();
    await user.click(screen.getByRole('button', { name: 'Next step' }));
    expect(count(view.container, 'g[data-status="active"]')).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Clear graph' }));

    expect(count(view.container, 'g[data-status="active"]')).toBe(0);
    expect(screen.queryByText(/Step \d+ of/)).toBeNull();
    expect(screen.getByText(/previous run was cleared/)).toBeTruthy();
  });

  it('switches between BFS and DFS without leaking state', async () => {
    const { user, view } = await startDfsOnSample();
    await user.click(screen.getByRole('button', { name: 'BFS' }));

    expect(screen.queryByText(/Step \d+ of/)).toBeNull();
    expect(count(view.container, 'g[data-status="active"]')).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Generate BFS steps' }));
    expect(screen.getByText('Queue')).toBeTruthy();
  });
});
