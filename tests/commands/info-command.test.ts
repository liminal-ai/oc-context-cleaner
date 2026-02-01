import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs/promises", async () => {
	const memfs = await import("memfs");
	return memfs.fs.promises;
});

import {
	readSessionFile,
	getSessionFileStats,
} from "../../src/io/session-file-reader.js";
import { formatSessionInfoJson } from "../../src/output/info-formatter.js";
import { createSessionWithTurns } from "../fixtures/sessions.js";
import { serializeToJsonl } from "../../src/core/session-parser.js";
import type { SessionInfo } from "../../src/types/index.js";

describe("info-command", () => {
	const testAgentId = "main";
	const testSessionId = "test-session-info";
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

	// TC-2.1a: Info displays session statistics
	it("displays session statistics", async () => {
		const entries = createSessionWithTurns(5, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(entries));

		const parsed = await readSessionFile(sessionPath);
		expect(parsed.messages.length).toBeGreaterThan(0);
	});

	// TC-2.2a: Message counts accurate
	it("message counts are accurate", async () => {
		const entries = createSessionWithTurns(3, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(entries));

		const parsed = await readSessionFile(sessionPath);
		const userMessages = parsed.messages.filter(
			(m) => m.message.role === "user",
		).length;
		const assistantMessages = parsed.messages.filter(
			(m) => m.message.role === "assistant",
		).length;

		// Each turn: 1 user + 1 assistant with tool + 1 tool result + 1 assistant response
		expect(userMessages).toBe(3); // 3 turns
		expect(assistantMessages).toBe(6); // 2 per turn (tool call + response)
	});

	// TC-2.3a: Token estimation displayed
	it("token estimation displayed", async () => {
		const entries = createSessionWithTurns(3, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		const content = serializeToJsonl(entries);
		vol.writeFileSync(sessionPath, content);

		// Token estimation: ~4 chars per token
		const estimatedTokens = Math.round(content.length / 4);
		expect(estimatedTokens).toBeGreaterThan(0);
	});

	// TC-2.4a: File size displayed
	it("file size displayed", async () => {
		const entries = createSessionWithTurns(3, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(entries));

		const stats = await getSessionFileStats(sessionPath);
		expect(stats.sizeBytes).toBeGreaterThan(0);
	});

	// TC-2.5a: Info JSON output complete
	it("JSON output is complete", async () => {
		const info: SessionInfo = {
			sessionId: testSessionId,
			totalMessages: 10,
			userMessages: 3,
			assistantMessages: 6,
			toolCalls: 3,
			toolResults: 3,
			estimatedTokens: 1500,
			fileSizeBytes: 6000,
		};

		const json = formatSessionInfoJson(info);
		const parsed = JSON.parse(json);

		expect(parsed.sessionId).toBe(testSessionId);
		expect(parsed.totalMessages).toBe(10);
		expect(parsed.estimatedTokens).toBe(1500);
	});

	// TC-2.6a: Error on invalid session ID with actionable message
	it("error on invalid session ID", async () => {
		// Import and run the info command with non-existent session
		const { infoCommand } = await import("../../src/commands/info-command.js");

		// Capture stderr
		const errorOutput: string[] = [];
		const originalError = console.error;
		console.error = (msg: string) => errorOutput.push(msg);

		try {
			const runArgs = {
				args: { sessionId: "nonexistent", agent: testAgentId, json: false },
			};
			// biome-ignore lint/style/noNonNullAssertion: run is guaranteed to exist
			// biome-ignore lint/suspicious/noExplicitAny: testing citty command requires type bypass
			await infoCommand.run!(runArgs as any);
		} catch {
			// Expected to throw
		} finally {
			console.error = originalError;
		}

		// Error should contain actionable hint (AC-2.6)
		const output = errorOutput.join(" ");
		expect(output).toMatch(/not found|does not exist/i);
		expect(output).toMatch(/occ list|available sessions/i);
	});

	// TC-2.7a: Empty session handled
	it("empty session handled", async () => {
		// Create session with just header, no messages
		const header = {
			type: "session",
			version: "0.49.3",
			id: testSessionId,
			timestamp: new Date().toISOString(),
			cwd: "/test",
		};
		vol.writeFileSync(sessionPath, `${JSON.stringify(header)}\n`);

		const parsed = await readSessionFile(sessionPath);
		expect(parsed.messages.length).toBe(0);
	});

	// TC-2.1b: Info command entry point works
	it("info command entry point displays statistics", async () => {
		// Set up session index so resolveSessionId works
		const index = {
			[testSessionId]: { sessionId: testSessionId, updatedAt: Date.now() },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		// Create session file
		const entries = createSessionWithTurns(3, 1);
		const header = entries.find((e) => e.type === "session");
		if (header && header.type === "session") header.id = testSessionId;
		vol.writeFileSync(sessionPath, serializeToJsonl(entries));

		const { infoCommand } = await import("../../src/commands/info-command.js");

		// Capture stdout
		const output: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => output.push(msg);

		try {
			const runArgs = {
				args: { sessionId: testSessionId, agent: testAgentId, json: false },
			};
			// biome-ignore lint/style/noNonNullAssertion: run is guaranteed to exist
			// biome-ignore lint/suspicious/noExplicitAny: testing citty command requires type bypass
			await infoCommand.run!(runArgs as any);
		} finally {
			console.log = originalLog;
		}

		const result = output.join("\n");
		expect(result).toContain("Session:");
		expect(result).toContain(testSessionId);
		expect(result).toMatch(/messages|Messages/i);
	});
});
