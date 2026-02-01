import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

// Mock the filesystem
vi.mock("node:fs/promises", async () => {
	const memfs = await import("memfs");
	return memfs.fs.promises;
});

// Import after mocking
import { executeClone } from "../../src/core/clone-operation-executor.js";
import { readSessionIndex } from "../../src/io/session-index-reader.js";
import { formatCloneResultJson } from "../../src/output/result-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";

// Note: generateSessionId and resolveSessionId are internal to executeClone
// and not needed as direct imports in tests.

describe("clone-command", () => {
	const testAgentId = "main";
	const testSessionId = "test-session-xyz789";
	const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;
	const sessionPath = `${sessionsDir}/${testSessionId}.jsonl`;

	beforeEach(() => {
		vol.reset();
		vol.mkdirSync(sessionsDir, { recursive: true });

		// Create a test session with tools
		const entries = createSessionWithTurns(10, 1);
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

		vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// TC-4.1a: Clone creates new UUID
	it("clone creates new session with new UUID", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		expect(result.success).toBe(true);
		expect(result.clonedSessionId).not.toBe(testSessionId);
		expect(result.clonedSessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
	});

	// TC-4.2a: Clone preserves text content
	it("clone preserves text content", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		const content = vol.readFileSync(
			result.clonedSessionPath,
			"utf-8",
		) as string;
		expect(content).toContain("User message for turn");
	});

	// TC-4.3a: Header has clone metadata
	it("header has clone metadata", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		const content = vol.readFileSync(
			result.clonedSessionPath,
			"utf-8",
		) as string;
		const firstLine = content.split("\n")[0];
		const header = JSON.parse(firstLine);

		expect(header.id).toBe(result.clonedSessionId);
		expect(header.clonedFrom).toBe(testSessionId);
		// Verify clonedAt is an ISO 8601 date string
		expect(header.clonedAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/,
		);
	});

	// TC-4.4a: No partial file on failure (atomicity test)
	// This test verifies atomic write behavior: either complete success or no file.
	// On failure, CloneOperationError is thrown and no partial file exists.
	it("no partial file on failure", async () => {
		// Use a path in a non-existent directory to trigger write failure
		const badOutputPath = "/nonexistent/directory/output.jsonl";

		// Atomicity invariant: must be complete success OR complete failure
		// (no partial files left behind)
		await expect(
			executeClone({
				sourceSessionId: testSessionId,
				agentId: testAgentId,
				outputPath: badOutputPath,
				noRegister: true,
				outputFormat: "human",
				verbose: false,
			}),
		).rejects.toThrow("Failed to clone session");

		// Verify no partial file was created
		expect(vol.existsSync(badOutputPath)).toBe(false);
	});

	// TC-4.5a: Custom output path respected
	it("custom output path respected", async () => {
		const customPath = "/mock/backup/my-clone.jsonl";
		vol.mkdirSync("/mock/backup", { recursive: true });

		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			outputPath: customPath,
			noRegister: true,
			outputFormat: "human",
			verbose: false,
		});

		expect(result.clonedSessionPath).toBe(customPath);
		expect(vol.existsSync(customPath)).toBe(true);
	});

	// TC-4.6a: JSON output complete
	it("JSON output is complete", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "json",
			verbose: false,
		});

		const json = formatCloneResultJson(result);
		const parsed = JSON.parse(json);

		expect(parsed.success).toBe(true);
		expect(parsed.mode).toBe("clone");
		expect(parsed.sourceSessionId).toBe(testSessionId);
		// Verify clonedSessionId is a valid UUID
		expect(parsed.clonedSessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		// Verify clonedSessionPath is a non-empty string
		expect(typeof parsed.clonedSessionPath).toBe("string");
		expect(parsed.clonedSessionPath.length).toBeGreaterThan(0);
		expect(parsed.statistics).toBeDefined();
		// Verify resumeCommand contains the session ID
		expect(parsed.resumeCommand).toContain(parsed.clonedSessionId);
	});

	// TC-4.7a: Clone without stripping preserves all
	it("clone without stripping preserves all content", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			// No toolRemoval specified
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		// Should have same message count
		expect(result.statistics.messagesOriginal).toBe(
			result.statistics.messagesCloned,
		);
		expect(result.statistics.toolCallsRemoved).toBe(0);
	});

	// TC-4.8a: Partial ID matching works
	it("partial ID matching works for clone", async () => {
		const result = await executeClone({
			sourceSessionId: "test-session", // Partial
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		expect(result.sourceSessionId).toBe(testSessionId);
	});

	// TC-4.9a: Clone updates session index
	it("clone updates session index", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: false,
			outputFormat: "human",
			verbose: false,
		});

		const index = await readSessionIndex(testAgentId);
		expect(index[result.clonedSessionId]).toBeDefined();
	});

	// TC-4.10a: No-register skips index
	it("no-register skips index update", async () => {
		const indexBefore = await readSessionIndex(testAgentId);
		const countBefore = Object.keys(indexBefore).length;

		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			noRegister: true,
			outputFormat: "human",
			verbose: false,
		});

		const indexAfter = await readSessionIndex(testAgentId);
		const countAfter = Object.keys(indexAfter).length;

		expect(countAfter).toBe(countBefore);
		expect(indexAfter[result.clonedSessionId]).toBeUndefined();
	});

	// TC-7.3a: JSON output complete (also covers CloneResult)
	// Uses "extreme" preset to ensure tool calls are removed (default keeps 20 turns, fixture only has 10)
	it("JSON output has all CloneResult fields", async () => {
		const result = await executeClone({
			sourceSessionId: testSessionId,
			agentId: testAgentId,
			toolRemoval: { preset: "extreme" },
			noRegister: false,
			outputFormat: "json",
			verbose: false,
		});

		expect(result.success).toBe(true);
		expect(result.mode).toBe("clone");
		expect(result.sourceSessionId).toBe(testSessionId);
		// Verify clonedSessionId is a valid UUID
		expect(result.clonedSessionId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
		// Verify clonedSessionPath is a non-empty string
		expect(typeof result.clonedSessionPath).toBe("string");
		expect(result.clonedSessionPath.length).toBeGreaterThan(0);
		// Verify all statistics are numbers
		expect(typeof result.statistics.messagesOriginal).toBe("number");
		expect(typeof result.statistics.messagesCloned).toBe("number");
		expect(typeof result.statistics.toolCallsOriginal).toBe("number");
		expect(typeof result.statistics.toolCallsRemoved).toBe("number");
		expect(typeof result.statistics.toolCallsTruncated).toBe("number");
		expect(typeof result.statistics.toolCallsPreserved).toBe("number");
		expect(typeof result.statistics.sizeOriginal).toBe("number");
		expect(typeof result.statistics.sizeCloned).toBe("number");
		expect(typeof result.statistics.reductionPercent).toBe("number");
		// TC-7.3a: Verify stripping actually occurred (toolRemoval was specified)
		expect(
			result.statistics.toolCallsRemoved + result.statistics.toolCallsTruncated,
		).toBeGreaterThan(0);
	});
});
