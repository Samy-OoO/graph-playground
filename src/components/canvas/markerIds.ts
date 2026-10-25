import type { EdgeStatus } from '../../algorithms/types';

export function getArrowMarkerId(status: EdgeStatus): string {
  return `arrowhead-${status}`;
}
