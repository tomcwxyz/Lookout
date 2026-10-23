import { parseCheckpoint, type CheckpointInput } from "./checkpoint";

export const contributionKinds = ["progress", "evidence", "blocker", "handover", "next_action"] as const;
export type ContributionKind = typeof contributionKinds[number];
export type AgentContributionInput = { kind: ContributionKind; checkpoint: CheckpointInput };

export function parseContribution(input: unknown): AgentContributionInput {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid contribution");
  const value = input as Record<string, unknown>;
  if (typeof value.kind !== "string" || !contributionKinds.some(kind => kind === value.kind))
    throw new Error("Invalid contribution kind");
  const checkpoint = parseCheckpoint(value.checkpoint);
  // Kind is a classification, not a claim of successful acceptance.
  return { kind: value.kind as ContributionKind, checkpoint };
}
