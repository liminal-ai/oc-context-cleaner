import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Default state directory for OpenClaw.
 */
export const DEFAULT_STATE_DIR = join(homedir(), ".clawdbot");

/**
 * Default agent ID.
 */
export const DEFAULT_AGENT_ID = "main";

/**
 * Get the state directory, respecting config and environment overrides.
 * Priority: configValue > env var > default
 */
export function getStateDirectory(configValue?: string): string {
	if (configValue) return configValue;
	return process.env.CLAWDBOT_STATE_DIR || DEFAULT_STATE_DIR;
}

/**
 * Get the sessions directory for an agent.
 */
export function getSessionsDirectory(
	agentId: string = DEFAULT_AGENT_ID,
	stateDir?: string,
): string {
	return join(getStateDirectory(stateDir), "agents", agentId, "sessions");
}

/**
 * Get the path to a session file.
 */
export function getSessionPath(
	sessionId: string,
	agentId: string = DEFAULT_AGENT_ID,
	stateDir?: string,
): string {
	return join(getSessionsDirectory(agentId, stateDir), `${sessionId}.jsonl`);
}

/**
 * Get the path to the session index file.
 */
export function getSessionIndexPath(
	agentId: string = DEFAULT_AGENT_ID,
	stateDir?: string,
): string {
	return join(getSessionsDirectory(agentId, stateDir), "sessions.json");
}

/**
 * Get the backup path for a session with monotonic numbering.
 */
export function getBackupPath(
	sessionId: string,
	backupNumber: number,
	agentId: string = DEFAULT_AGENT_ID,
	stateDir?: string,
): string {
	return join(
		getSessionsDirectory(agentId, stateDir),
		`${sessionId}.backup.${backupNumber}.jsonl`,
	);
}

/**
 * Resolve agent ID from flag, config, or environment.
 * Priority: flagValue > configValue > env var > default
 */
export function resolveAgentId(
	flagValue?: string,
	configValue?: string,
): string {
	if (flagValue) return flagValue;
	if (configValue) return configValue;
	return process.env.CLAWDBOT_AGENT_ID || DEFAULT_AGENT_ID;
}
