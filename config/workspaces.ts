/** Workspace execution defaults. Change them together with their rollout/worker configuration. */
const workspacesConfig = {
  invitationDays: 7,
  leaseSeconds: 120,
  heartbeatMilliseconds: 30_000,
  maximumAttempts: 3,
  dispatchBatchSize: 100,
  providerImageUrlSeconds: 120,
}
export default workspacesConfig
