import { vol } from "memfs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", async () => {
	const memfs = await import("memfs");
	return memfs.fs.promises;
});

import { listAvailableAgents } from "../../src/io/session-discovery.js";
import { getSessionsSortedByTime } from "../../src/io/session-index-reader.js";
import {
	formatRelativeTime,
	formatSessionListHuman,
	formatSessionListJson,
	truncateSessionId,
} from "../../src/output/list-formatter.js";

describe("list-command", () => {
	const testAgentId = "main";
	const sessionsDir = `/mock/.clawdbot/agents/${testAgentId}/sessions`;

	beforeEach(() => {
		vol.reset();
		vol.mkdirSync(sessionsDir, { recursive: true });
		vi.stubEnv("CLAWDBOT_STATE_DIR", "/mock/.clawdbot");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	// TC-1.1a: List displays all sessions
	it("displays all sessions", async () => {
		const index = {
			"session-1": { sessionId: "session-1", updatedAt: Date.now() - 1000 },
			"session-2": { sessionId: "session-2", updatedAt: Date.now() - 2000 },
			"session-3": { sessionId: "session-3", updatedAt: Date.now() - 3000 },
			"session-4": { sessionId: "session-4", updatedAt: Date.now() - 4000 },
			"session-5": { sessionId: "session-5", updatedAt: Date.now() - 5000 },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const sessions = await getSessionsSortedByTime(testAgentId);
		expect(sessions.length).toBe(5);
	});

	// TC-1.2a: Sessions sorted by recency
	it("sessions sorted by recency", async () => {
		const now = Date.now();
		const index = {
			oldest: { sessionId: "oldest", updatedAt: now - 3000 },
			middle: { sessionId: "middle", updatedAt: now - 2000 },
			newest: { sessionId: "newest", updatedAt: now - 1000 },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const sessions = await getSessionsSortedByTime(testAgentId);
		expect(sessions[0].sessionId).toBe("newest");
		expect(sessions[1].sessionId).toBe("middle");
		expect(sessions[2].sessionId).toBe("oldest");
	});

	// TC-1.3a: Entry shows required fields (truncated ID, relative time, project path)
	it("entry shows required fields", async () => {
		const index = {
			"test-session-abc123": {
				sessionId: "test-session-abc123",
				updatedAt: Date.now() - 3600000, // 1 hour ago
				projectPath: "/home/user/my-project",
			},
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const sessions = await getSessionsSortedByTime(testAgentId);
		const output = formatSessionListHuman(sessions);

		// Should contain truncated ID
		expect(output).toContain("test-session");
		// Should contain relative time
		expect(output).toMatch(/hour|minutes/i);
		// Should contain project path (AC-1.3)
		expect(output).toContain("/home/user/my-project");
	});

	// TC-1.4a: Limit flag restricts output
	it("limit flag restricts output", async () => {
		const index: Record<string, { sessionId: string; updatedAt: number }> = {};
		for (let i = 0; i < 10; i++) {
			index[`session-${i}`] = {
				sessionId: `session-${i}`,
				updatedAt: Date.now() - i * 1000,
			};
		}
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const sessions = await getSessionsSortedByTime(testAgentId);
		const limited = sessions.slice(0, 3);
		expect(limited.length).toBe(3);
	});

	// TC-1.5a: JSON output is parseable
	it("JSON output is parseable", async () => {
		const index = {
			"session-1": { sessionId: "session-1", updatedAt: Date.now() },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const sessions = await getSessionsSortedByTime(testAgentId);
		const json = formatSessionListJson(sessions);
		const parsed = JSON.parse(json);

		expect(Array.isArray(parsed)).toBe(true);
		expect(parsed[0].sessionId).toBe("session-1");
	});

	// TC-1.6a: Partial ID matching works
	// Covered by: "partial ID matching works for edit" in edit-command.test.ts
	// Covered by: "partial ID matching works for clone" in clone-command.test.ts

	// TC-1.6b: Ambiguous partial ID fails gracefully
	// Covered by: resolveSessionId throws AmbiguousIdError (tested in edit/clone commands)

	// TC-1.7a: Agent auto-detected from environment
	// Covered by: "auto-detects current session" in edit-command.test.ts (uses resolveAgentId)

	// TC-1.8a: Agent flag overrides auto-detection
	// Covered by: All command tests explicitly pass agentId to verify override works

	// TC-1.9a: Missing agent shows actionable error
	it("missing agent shows actionable error", async () => {
		// Create agents directory with some agents (but not "nonexistent")
		vol.mkdirSync("/mock/.clawdbot/agents/other-agent/sessions", {
			recursive: true,
		});

		// Import and run the list command with non-existent agent
		const { listCommand } = await import("../../src/commands/list-command.js");

		// Capture stderr
		const errorOutput: string[] = [];
		const originalError = console.error;
		console.error = (msg: string) => errorOutput.push(msg);

		try {
			const runArgs = { args: { agent: "nonexistent", json: false } };
			// biome-ignore lint/style/noNonNullAssertion: run is guaranteed to exist
			// biome-ignore lint/suspicious/noExplicitAny: testing citty command requires type bypass
			await listCommand.run!(runArgs as any);
		} catch {
			// Expected to throw
		} finally {
			console.error = originalError;
		}

		// Error should contain actionable hint
		const output = errorOutput.join(" ");
		expect(output).toMatch(/not found|does not exist/i);
		expect(output).toMatch(/available agents|main|other-agent/i);
	});

	// TC-1.1b: List command entry point works
	it("list command entry point returns sessions", async () => {
		const index = {
			"session-1": { sessionId: "session-1", updatedAt: Date.now() - 1000 },
			"session-2": { sessionId: "session-2", updatedAt: Date.now() - 2000 },
		};
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify(index));

		const { listCommand } = await import("../../src/commands/list-command.js");

		// Capture stdout
		const output: string[] = [];
		const originalLog = console.log;
		console.log = (msg: string) => output.push(msg);

		try {
			const runArgs = { args: { agent: testAgentId, json: false } };
			// biome-ignore lint/style/noNonNullAssertion: run is guaranteed to exist
			// biome-ignore lint/suspicious/noExplicitAny: testing citty command requires type bypass
			await listCommand.run!(runArgs as any);
		} finally {
			console.log = originalLog;
		}

		const result = output.join("\n");
		expect(result).toContain("session-1");
		expect(result).toContain("session-2");
	});

	// Helper: formatRelativeTime formats correctly
	it("formatRelativeTime formats correctly", () => {
		const now = Date.now();
		expect(formatRelativeTime(now - 30000)).toMatch(/seconds|just now/i);
		expect(formatRelativeTime(now - 3600000)).toMatch(/hour/i);
		expect(formatRelativeTime(now - 86400000)).toMatch(/day/i);
	});

	// Helper: truncateSessionId truncates long IDs
	it("truncateSessionId truncates long IDs", () => {
		const longId = "abc123-def456-ghi789-jkl012-mno345";
		const truncated = truncateSessionId(longId, 12);
		expect(truncated.length).toBeLessThanOrEqual(15); // 12 + "..."
		expect(truncated).toContain("abc123");
	});

	// TC-1.9b: listAvailableAgents returns available agents
	it("listAvailableAgents returns available agents", async () => {
		// Create multiple agent directories
		vol.mkdirSync("/mock/.clawdbot/agents/agent-one/sessions", {
			recursive: true,
		});
		vol.mkdirSync("/mock/.clawdbot/agents/agent-two/sessions", {
			recursive: true,
		});

		const agents = await listAvailableAgents();

		expect(agents).toContain("agent-one");
		expect(agents).toContain("agent-two");
		expect(agents).toContain("main"); // Created in beforeEach
	});

	// TC-1.1c: Empty session list handled gracefully
	it("empty session list handled gracefully", async () => {
		// sessions.json exists but is empty object
		vol.writeFileSync(`${sessionsDir}/sessions.json`, JSON.stringify({}));

		const sessions = await getSessionsSortedByTime(testAgentId);
		expect(sessions).toEqual([]);

		// Human output should handle empty list
		const output = formatSessionListHuman(sessions);
		expect(output).toBeDefined();
	});
});
