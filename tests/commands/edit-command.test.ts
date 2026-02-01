import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

// Mock the filesystem
vi.mock("node:fs/promises", async () => {
	const memfs = await import("memfs");
	return memfs.fs.promises;
});

// Import after mocking
import { executeEdit } from "../../src/core/edit-operation-executor.js";
import {
	createBackup,
	getBackupNumbers,
} from "../../src/core/backup-manager.js";
import { resolveSessionId } from "../../src/io/session-discovery.js";
import {
	formatEditResultHuman,
	formatEditResultJson,
} from "../../src/output/result-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";

describe("edit-command", () => {
	const testAgentId = "main";
	const testSessionId = "test-session-abc123";
	const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
	const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

	beforeEach(() => {
		vol.reset();
		// Set up mock filesystem
		vol.mkdirSync(sessionsDir, { recursive: true });

		// Create a test session with tools
		const entries = createSessionWithTurns(15, 1);
		// Override the random session ID
		if (entries[0].type === "session") {
			entries[0].id = testSessionId;
		}
		const content = serializeToJsonl(entries);
		vol.writeFileSync(sessionPath, content);

		// Create sessions.json index
		const index = {
			[testSessionId]: {
				sessionId: testSessionId,
				updatedAt: Date.now(),
			},
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		// Mock environment
		vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// TC-3.1a: Edit modifies session in place
	it("edit modifies session in place", async () => {
		const originalContent = vol.readFileSync(sessionPath, "utf-8");

		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		expect(result.success).toBe(true);
		expect(result.sessionId).toBe(testSessionId);

		const newContent = vol.readFileSync(sessionPath, "utf-8");
		expect(newContent).not.toBe(originalContent);
	});

	// TC-3.2a: Backup created before modify
	it("backup created before modifying", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		expect(result.backupPath).toBeTruthy();
		expect(vol.existsSync(result.backupPath)).toBe(true);
	});

	// TC-3.3a: Text content preserved
	it("preserves text content", async () => {
		await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		// Read and check that user messages are preserved
		const content = vol.readFileSync(sessionPath, "utf-8") as string;
		expect(content).toContain("User message for turn");
	});

	// TC-3.4a: Failed edit leaves original unchanged
	it("failed edit leaves original unchanged", async () => {
		const originalContent = vol.readFileSync(sessionPath, "utf-8");

		// Mock writeSessionFile to throw after backup is created
		const writeSessionFileSpy = vi
			.spyOn(
				await import("../../src/io/session-file-writer.js"),
				"writeSessionFile",
			)
			.mockRejectedValueOnce(new Error("Simulated write failure"));

		try {
			await executeEdit({
				sessionId: testSessionId,
				agentId: testAgentId,
				toolRemoval: { preset: "default" },
				outputFormat: "human",
				verbose: false,
			});
		} catch {
			// Expected to throw
		}

		// Verify original file is unchanged
		const afterContent = vol.readFileSync(sessionPath, "utf-8");
		expect(afterContent).toBe(originalContent);

		writeSessionFileSpy.mockRestore();
	});

	// TC-3.5a: JSON output complete
	it("JSON output is complete", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "json",
			verbose: false,
		});

		const json = formatEditResultJson(result);
		const parsed = JSON.parse(json);

		expect(parsed.success).toBe(true);
		expect(parsed.mode).toBe("edit");
		expect(parsed.sessionId).toBe(testSessionId);
		expect(parsed.backupPath).toBeTruthy();
		expect(parsed.statistics).toBeDefined();
		expect(parsed.statistics.messagesOriginal).toBeGreaterThan(0);
		expect(parsed.statistics.reductionPercent).toBeDefined();
	});

	// TC-3.6a: Partial ID matching works
	it("partial ID matching works for edit", async () => {
		const resolved = await resolveSessionId("test-session", testAgentId);
		expect(resolved).toBe(testSessionId);
	});

	// TC-3.7a: Session ID unchanged after edit
	it("session remains resumable after edit", async () => {
		await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		// Verify session ID in file is unchanged
		const content = vol.readFileSync(sessionPath, "utf-8") as string;
		const firstLine = content.split("\n")[0];
		const header = JSON.parse(firstLine);
		expect(header.id).toBe(testSessionId);
	});

	// TC-3.8a: Auto-detect current session
	it("auto-detects current session", async () => {
		const resolved = await resolveSessionId(undefined, testAgentId);
		expect(resolved).toBe(testSessionId);
	});

	// TC-3.8b: Auto-detect fails gracefully
	it("auto-detect fails gracefully outside session", async () => {
		// Remove all sessions
		vol.unlinkSync(sessionPath);
		vol.writeFileSync(`${sessionsDir}/sessions.json`, "{}");

		await expect(resolveSessionId(undefined, testAgentId)).rejects.toThrow();
	});

	// TC-6.1a: Backup created on edit
	it("backup created on edit", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		const backupExists = vol.existsSync(result.backupPath);
		expect(backupExists).toBe(true);
	});

	// TC-6.2a: Backup uses monotonic numbering
	it("backup uses monotonic numbering", async () => {
		// Create first backup
		const backupPath1 = await createBackup(sessionPath, testAgentId);
		expect(backupPath1).toContain(".backup.1.jsonl");

		// Create second backup
		const backupPath2 = await createBackup(sessionPath, testAgentId);
		expect(backupPath2).toContain(".backup.2.jsonl");
	});

	// TC-6.5a: Backup rotation at max 5
	it("backup rotation maintains max 5", async () => {
		// Create 5 backups
		for (let i = 1; i <= 5; i++) {
			const path = `${sessionsDir}/${testSessionId}.backup.${i}.jsonl`;
			vol.writeFileSync(path, "backup content");
		}

		// Create 6th backup
		const newBackupPath = await createBackup(sessionPath, testAgentId);

		// Should have deleted .backup.1 and created .backup.6
		expect(
			vol.existsSync(`${sessionsDir}/${testSessionId}.backup.1.jsonl`),
		).toBe(false);
		expect(newBackupPath).toContain(".backup.6.jsonl");

		const numbers = await getBackupNumbers(testSessionId, testAgentId);
		expect(numbers.length).toBe(5);
	});

	// TC-6.5b: Backups accumulate under limit
	it("backups accumulate up to limit", async () => {
		// Create 3 backups
		for (let i = 0; i < 3; i++) {
			await createBackup(sessionPath, testAgentId);
		}

		const numbers = await getBackupNumbers(testSessionId, testAgentId);
		expect(numbers.length).toBe(3);
	});

	// TC-7.1a: Default output is human-readable
	it("default output is human-readable", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		const output = formatEditResultHuman(result, false);
		expect(output).toContain("Session edited");
		expect(output).toContain(testSessionId.slice(0, 8)); // Truncated ID
	});

	// TC-7.2a: Human output includes required fields
	it("human output includes required fields", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		const output = formatEditResultHuman(result, false);
		expect(output).toContain("Messages");
		expect(output).toContain("Tool calls");
		expect(output).toContain("Backup");
	});

	// TC-7.4a: Verbose shows detailed statistics
	it("verbose shows detailed statistics", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: true,
		});

		const output = formatEditResultHuman(result, true);
		expect(output).toContain("Statistics");
		// Should have more detail than non-verbose
		expect(output.length).toBeGreaterThan(
			formatEditResultHuman(result, false).length,
		);
	});

	// TC-7.5a: Success returns exit code 0
	// Note: This tests the executor's success flag, not CLI exit codes.
	// The CLI wrapper (edit-command.ts) sets process.exitCode based on result.success.
	it("success returns exit code 0", async () => {
		const result = await executeEdit({
			sessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "default" },
			outputFormat: "human",
			verbose: false,
		});

		expect(result.success).toBe(true);
	});

	// TC-7.5b: Failure returns non-zero
	// Note: This tests the executor throws on failure, not CLI exit codes.
	// The CLI wrapper (edit-command.ts) catches errors and sets process.exitCode = 1.
	it("failure returns non-zero exit code", async () => {
		await expect(
			executeEdit({
				sessionId: "nonexistent-session",
				agentId: testAgentId,
				toolRemoval: { preset: "default" },
				outputFormat: "human",
				verbose: false,
			}),
		).rejects.toThrow();
	});

	// TC-7.6a: Error messages are actionable
	it("error messages are actionable", async () => {
		try {
			await executeEdit({
				sessionId: "nonexistent",
				agentId: testAgentId,
				toolRemoval: { preset: "default" },
				outputFormat: "human",
				verbose: false,
			});
		} catch (error) {
			expect((error as Error).message).toContain("not found");
		}
	});
});
