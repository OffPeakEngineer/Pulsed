export type {
  StasisManifest,
  StasisPage,
  StasisPageMetadata,
  StasisSite,
  StasisSource,
  StasisStatus,
} from '../../packages/stasis/src/index'

export type PipelineSnapshot = {
  schemaVersion: number
  generatedAt: string | null
  lastSuccessAt: string | null
  stale: boolean
  projects: Array<{
    name: string
    labels: string[]
    branch: string
    projectUrl: string
    pipeline: null | {
      id: number
      iid: number
      status: string
      url: string
      sha: string
      updatedAt: string
      jobs?: Array<{ id: number, name: string, stage: string, status: string, url: string }>
    }
  }>
  errors: Array<{ project: string, message: string }> | null
}
