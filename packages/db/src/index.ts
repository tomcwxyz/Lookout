export { databaseConfigured, getDatabase, closeDatabase } from "./client";
export { getPortfolio, getProject, saveAssessment, lookupHash, stableSnapshotHash, createSyncRun, finishSyncRun, saveIdea } from "./repository";
export {
  saveInfrastructureObservation, beginSourceSync, completeSourceSync,
  getInfrastructurePortfolio, getLinkedResources, setInfrastructureProjectLink
} from "./infrastructure-repository";
export { withObservationLease, ObservationAlreadyRunningError } from "./observation-lock";

export { saveWorkDecision, acceptedWorkStatuses } from "./repository";
export type { AcceptedWorkStatus } from "./repository";

export {
  createAgentToken,listAgentTokens,revokeAgentToken,authoriseAgentToken,
  submitAgentCheckpoint,listAgentCheckpoints,getAgentHandover,CheckpointConflictError
} from "./agent-repository";

export {
  createOAuthCode, consumeOAuthCode, issueOAuthTokens, rotateOAuthRefreshToken,
  authoriseOAuthAccessToken, verifyPKCE, revokeAllOAuthTokens
} from "./oauth-repository";
export type { OAuthCode } from "./oauth-repository";

export {
  saveRepositoryInventory, getGithubScanOffset, advanceGithubScanOffset, markRepositoryInspected,
  getLogicalPortfolio, getLogicalProject, createLogicalProject, confirmLogicalProject,
  assignRepositoryToProject, assignInfrastructureToProject, getUnassignedInfrastructure, confirmedProjectStatuses
} from "./portfolio-repository";
export type { DiscoveredRepository, ConfirmedProjectStatus } from "./portfolio-repository";

export { submitAgentContribution, listPortfolioContributions, getPortfolioIdForObservedProject,
  getPortfolioContributionHandover, ContributionConflictError, ContributionScopeError } from "./contribution-repository";
