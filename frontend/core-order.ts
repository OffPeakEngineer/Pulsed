export type CoreOrder = 'node' | 'hottest' | 'coldest' | 'eq'
export interface ClusterCore { node: string; index: number; percent: number }

// Resolve equal readings by identity so refreshes do not shuffle idle cores.
export function orderClusterCores<T extends ClusterCore>(cores: readonly T[], order: CoreOrder): T[] {
  const identity = (a: T, b: T) => a.node.localeCompare(b.node, undefined, { numeric: true }) || a.index - b.index
  const sorted = [...cores].sort(order === 'node' ? identity
    : (a, b) => (order === 'coldest' ? a.percent - b.percent : b.percent - a.percent) || identity(a, b))
  if (order !== 'eq') return sorted
  const centered = new Array<T>(sorted.length)
  const middle = Math.floor((sorted.length - 1) / 2)
  sorted.forEach((core, rank) => {
    const offset = Math.ceil(rank / 2)
    centered[middle + (rank % 2 ? offset : -offset)] = core
  })
  return centered
}
