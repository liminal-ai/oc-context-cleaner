import { vol } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
	const memfs = await import("memfs");
	return memfs.fs.promises;
});

import { restoreFromBackup } from "../../src/core/backup-manager.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";

describe("restore-command", () => {
	const testAgentId = "main";
	const testSessionId = "test-session-restore";
	const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
	const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

	beforeEach(() => {
		vol.reset();
		vol.mkdirSync(sessionsDir, { recursive: true });
		vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// TC-6.3a: Restore recovers from backup
	it("restore recovers from backup", async () => {
		// Create original content
		const originalEntries = createSessionWithTurns(5, 1);
		const origHeader = originalEntries.find((e) => e.type === "session");
		if (origHeader && origHeader.type === "session")
			origHeader.id = testSessionId;
		const originalContent = serializeToJsonl(originalEntries);
		vol.writeFileSync(sessionPath, originalContent);

		// Create backup
		const backupPath = `${sessionsDir}/${testSessionId}.backup.1.jsonl`;
		vol.writeFileSync(backupPath, originalContent);

		// Modify current session
		const modifiedEntries = createSessionWithTurns(2, 0);
		const modHeader = modifiedEntries.find((e) => e.type === "session");
		if (modHeader && modHeader.type === "session") modHeader.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(modifiedEntries));

		// Restore from backup
		await restoreFromBackup(testSessionId, testAgentId);

		// Verify restored content matches backup
		const restoredContent = vol.readFileSync(sessionPath, "utf-8");
		expect(restoredContent).toBe(originalContent);
	});

	// TC-6.4a: Restore fails gracefully without backup
	it("restore fails gracefully without backup", async () => {
		// Create session without backup
		const entries = createSessionWithTurns(3, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(entries));

		// Attempt restore
		await expect(restoreFromBackup(testSessionId, testAgentId)).rejects.toThrow(
			/no backup/i,
		);
	});

	// TC-6.3b: Restore command entry point works
	it("restore command entry point recovers session", async () => {
		// Set up session index
		const index = {
			[testSessionId]: { sessionId: testSessionId, updatedAt: Date.now() },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		// Create original content and backup
		const originalEntries = createSessionWithTurns(5, 1);
		const origHeader = originalEntries.find((e) => e.type === "session");
		if (origHeader && origHeader.type === "session")
			origHeader.id = testSessionId;
		const originalContent = serializeToJsonl(originalEntries);

		// Create backup
		const backupPath = `${sessionsDir}/${testSessionId}.backup.1.jsonl`;
		vol.writeFileSync(backupPath, originalContent);

		// Modify current session
		const modifiedEntries = createSessionWithTurns(2, 0);
		const modHeader = modifiedEntries.find((e) => e.type === "session");
		if (modHeader && modHeader.type === "session") modHeader.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(modifiedEntries));

		const { restoreCommand } = await import(
			"../../src/commands/restore-command.js"
		);

		// Capture stdout
		const output: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => output.push(msg);

		try {
			const runArgs = {
				args: { sessionId: testSessionId, agent: testAgentId },
			};
			// biome-ignore lint/style/noNonNullAssertion: run is guaranteed to exist
			// biome-ignore lint/suspicious/noExplicitAny: testing citty command requires type bypass
			await restoreCommand.run!(runArgs as any);
		} finally {
			console.log = originalLog;
		}

		// Verify command output
		const result = output.join("\n");
		expect(result).toMatch(/restored|Restored/i);

		// Verify content was restored
		const restoredContent = vol.readFileSync(sessionPath, "utf-8");
		expect(restoredContent).toBe(originalContent);
	});
});
