import config from '#config/open_router'
import contextualization from '#config/contextualization'

/**
 * The configuration a processing run was prepared with. A run is only usable as evidence while
 * every field still matches the current configuration; any change re-prepares the source.
 */
export type RunIdentity = {
  pipelineVersion: string
  embeddingModel: string | null
  embeddingDimensions: number | null
  contextualizer: string | null
}

export const currentRunIdentity = (): RunIdentity => ({
  pipelineVersion: config.pipelineVersion,
  embeddingModel: config.embeddingModel,
  embeddingDimensions: config.embeddingDimensions,
  contextualizer: contextualization.identity,
})

export const isCurrentRun = (run: RunIdentity) => {
  const current = currentRunIdentity()
  return (Object.keys(current) as (keyof RunIdentity)[]).every((key) => run[key] === current[key])
}
