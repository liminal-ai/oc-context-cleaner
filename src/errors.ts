/**
 * Base error class for oc-context-cleaner.
 * All custom errors extend this for consistent handling.
 */
export class OccError extends Error {
	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
		this.name = "OccError";
	}
}

/**
 * Thrown during skeleton phase to mark unimplemented code.
 * Should never appear in production—all stubs replaced before ship.
 */
export class NotImplementedError extends OccError {
	constructor(feature: string) {
		super(`Not implemented: ${feature}`, "NOT_IMPLEMENTED");
		this.name = "NotImplementedError";
	}
}

/**
 * Session not found by ID or partial match.
 * Resolution hint: "Use 'occ list' to see available sessions"
 */
export class SessionNotFoundError extends OccError {
	constructor(public readonly sessionId: string) {
		super(`Session '${sessionId}' not found`, "SESSION_NOT_FOUND");
		this.name = "SessionNotFoundError";
	}
}

/**
 * Partial session ID matches multiple sessions.
 * Includes list of matching session IDs for user to disambiguate.
 */
export class AmbiguousSessionError extends OccError {
	constructor(
		public readonly partial: string,
		public readonly matches: string[],
	) {
		super(
			`Multiple sessions match '${partial}': ${matches.join(", ")}`,
			"AMBIGUOUS_SESSION",
		);
		this.name = "AmbiguousSessionError";
	}
}

/**
 * Edit operation failed (parse, write, or backup error).
 */
export class EditOperationError extends OccError {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message, "EDIT_FAILED");
		this.name = "EditOperationError";
	}
}

/**
 * Clone operation failed.
 */
export class CloneOperationError extends OccError {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message, "CLONE_FAILED");
		this.name = "CloneOperationError";
	}
}

/**
 * Restore operation failed (no backup or write error).
 */
export class RestoreError extends OccError {
	constructor(message: string) {
		super(message, "RESTORE_FAILED");
		this.name = "RestoreError";
	}
}

/**
 * No sessions found for agent.
 */
export class NoSessionsError extends OccError {
	constructor(public readonly agentId: string) {
		super(`No sessions found for agent '${agentId}'`, "NO_SESSIONS");
		this.name = "NoSessionsError";
	}
}

/**
 * Unknown preset name requested.
 */
export class UnknownPresetError extends OccError {
	constructor(public readonly presetName: string) {
		super(`Unknown preset: ${presetName}`, "UNKNOWN_PRESET");
		this.name = "UnknownPresetError";
	}
}

/**
 * Agent not found or cannot be determined.
 */
export class AgentNotFoundError extends OccError {
	constructor(
		message: string,
		public readonly availableAgents?: string[],
	) {
		super(message, "AGENT_NOT_FOUND");
		this.name = "AgentNotFoundError";
	}
}
