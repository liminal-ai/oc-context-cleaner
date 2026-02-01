import type { EditResult, CloneResult } from "../types/index.js";

/**
 * Format edit result for human output.
 */
export function formatEditResultHuman(
	result: EditResult,
	verbose: boolean,
): string {
	const lines: string[] = [];

	lines.push(`✓ Session edited: ${result.sessionId}`);

	const messageReduction =
		result.statistics.messagesOriginal > 0
			? ((result.statistics.messagesOriginal -
					result.statistics.messagesAfter) /
					result.statistics.messagesOriginal) *
				100
			: 0;

	lines.push(
		`  Messages: ${result.statistics.messagesOriginal} → ${result.statistics.messagesAfter} ` +
			`(${formatPercent(messageReduction)} reduction)`,
	);
	lines.push(
		`  Tool calls: ${result.statistics.toolCallsRemoved} removed, ` +
			`${result.statistics.toolCallsTruncated} truncated, ` +
			`${result.statistics.toolCallsPreserved} preserved`,
	);
	lines.push(
		`  Size: ${formatFileSize(result.statistics.sizeOriginal)} → ` +
			`${formatFileSize(result.statistics.sizeAfter)} ` +
			`(${formatPercent(result.statistics.reductionPercent)} reduction)`,
	);
	lines.push(`  Backup: ${result.backupPath}`);

	if (verbose) {
		lines.push("");
		lines.push("Statistics:");
		lines.push(
			`  Messages original:     ${result.statistics.messagesOriginal}`,
		);
		lines.push(`  Messages after:        ${result.statistics.messagesAfter}`);
		lines.push(
			`  Tool calls original:   ${result.statistics.toolCallsOriginal}`,
		);
		lines.push(
			`  Tool calls removed:    ${result.statistics.toolCallsRemoved}`,
		);
		lines.push(
			`  Tool calls truncated:  ${result.statistics.toolCallsTruncated}`,
		);
		lines.push(
			`  Tool calls preserved:  ${result.statistics.toolCallsPreserved}`,
		);
		lines.push(
			`  Size original:         ${formatFileSize(result.statistics.sizeOriginal)}`,
		);
		lines.push(
			`  Size after:            ${formatFileSize(result.statistics.sizeAfter)}`,
		);
		lines.push(
			`  Reduction:             ${formatPercent(result.statistics.reductionPercent)}`,
		);
	}

	return lines.join("\n");
}

/**
 * Format edit result for JSON output.
 */
export function formatEditResultJson(result: EditResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Format clone result for human output.
 */
export function formatCloneResultHuman(
	result: CloneResult,
	verbose: boolean,
): string {
	const lines: string[] = [];

	lines.push(
		`✓ Session cloned: ${result.sourceSessionId} → ${result.clonedSessionId}`,
	);
	lines.push(
		`  Messages: ${result.statistics.messagesOriginal} → ${result.statistics.messagesCloned}`,
	);
	lines.push(
		`  Tool calls: ${result.statistics.toolCallsRemoved} removed, ` +
			`${result.statistics.toolCallsTruncated} truncated, ` +
			`${result.statistics.toolCallsPreserved} preserved`,
	);
	lines.push(
		`  Size: ${formatFileSize(result.statistics.sizeOriginal)} → ` +
			`${formatFileSize(result.statistics.sizeCloned)} ` +
			`(${formatPercent(result.statistics.reductionPercent)} reduction)`,
	);

	if (result.resumeCommand) {
		lines.push(`  Resume: ${result.resumeCommand}`);
	}

	if (verbose) {
		lines.push("");
		lines.push("Statistics:");
		lines.push(
			`  Messages original:     ${result.statistics.messagesOriginal}`,
		);
		lines.push(`  Messages cloned:       ${result.statistics.messagesCloned}`);
		lines.push(
			`  Tool calls original:   ${result.statistics.toolCallsOriginal}`,
		);
		lines.push(
			`  Tool calls removed:    ${result.statistics.toolCallsRemoved}`,
		);
		lines.push(
			`  Tool calls truncated:  ${result.statistics.toolCallsTruncated}`,
		);
		lines.push(
			`  Tool calls preserved:  ${result.statistics.toolCallsPreserved}`,
		);
	}

	return lines.join("\n");
}

/**
 * Format clone result for JSON output.
 */
export function formatCloneResultJson(result: CloneResult): string {
	return JSON.stringify(result, null, 2);
}

/**
 * Format file size in human-readable format.
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format percentage.
 */
export function formatPercent(value: number): string {
	return `${Math.round(value)}%`;
}
