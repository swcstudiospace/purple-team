/**
 * Pure matching between a stored run card and an incoming `purple-run` event.
 *
 * Repo-ingest cards carry the ingest runId; mission progress and stop events
 * carry the mission id as runId. A card is linked to its mission through
 * `missionId`, so either side's id can resolve the other. No JSX here: this
 * module is imported by tests and by the chat thread reducer alike.
 */

/** The identity fields a run card and a `purple-run` event share. */
export interface PurpleRunIdentity {
  runId: string;
  missionId?: string;
}

/** True when `event` belongs to the run card described by `data`. */
export function purpleRunMatches(data: PurpleRunIdentity, event: PurpleRunIdentity): boolean {
  if (data.runId === event.runId) return true;
  if (data.missionId === event.runId) return true;
  if (event.missionId === undefined) return false;
  return data.runId === event.missionId || data.missionId === event.missionId;
}
