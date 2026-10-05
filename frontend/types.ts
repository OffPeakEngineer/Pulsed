export type Observation = { at: number; average: number; peak: number; ttlSeconds: number; cores?: number[] }
export type Node = {
  Name: string; State: 'fresh' | 'stale' | 'offline'; StatusLabel: string
  CPUAvg: number; CPUMax: number; CoreCount: number; MemPct: number; MemLabel: string
  MemTotal: number; AgeLabel: string; Load1: number; Load5: number; Load15: number
}
export type Snapshot = {
  generatedAt: number; servingNode: string; nodes: Node[] | null
  history: Record<string, Observation[]>
}
