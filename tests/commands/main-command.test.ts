import { afterEach, describe, expect, it, vi } from "vitest";
import {
	mainCommand,
	QUICKSTART_TEXT,
} from "../../src/commands/main-command.js";

describe("main-command", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	// TC-7.7a: Help flag shows usage
	it("help is available via citty with all subcommands", () => {
		// citty handles --help automatically
		// Verify command metadata and structure is correct for help generation
		// Use non-null assertions since we know these values are not promises in our definition
		const meta = mainCommand.meta as { name: string; description: string };
		expect(meta.name).toBe("occ");
		expect(meta.description).toBeTruthy();
		expect(meta.description).toContain("Context Cleaner");

		// Verify all subcommands are registered
		expect(mainCommand.subCommands).toBeDefined();
		const subCmds = Object.keys(mainCommand.subCommands ?? {});
		expect(subCmds).toContain("edit");
		expect(subCmds).toContain("clone");
		expect(subCmds).toContain("list");
		expect(subCmds).toContain("info");
		expect(subCmds).toContain("restore");

		// Verify quickstart arg is defined for help display
		expect(mainCommand.args).toBeDefined();
		const args = mainCommand.args as {
			quickstart: { description: string };
		};
		expect(args.quickstart).toBeDefined();
		expect(args.quickstart.description).toBeTruthy();
	});

	// TC-7.8a: Quickstart shows condensed help (~250 tokens)
	it("quickstart text content is agent-friendly", () => {
		expect(QUICKSTART_TEXT).toBeTruthy();
		expect(QUICKSTART_TEXT.length).toBeLessThan(1500); // ~250 tokens = 1000-1500 chars
		expect(QUICKSTART_TEXT).toContain("WHEN TO USE");
		expect(QUICKSTART_TEXT).toContain("PRESETS");
		expect(QUICKSTART_TEXT).toContain("COMMON COMMANDS");
		expect(QUICKSTART_TEXT).toContain("occ edit");
		expect(QUICKSTART_TEXT).toContain("occ clone");
		expect(QUICKSTART_TEXT).toContain("occ list");
		expect(QUICKSTART_TEXT).toContain("occ info");
		expect(QUICKSTART_TEXT).toContain("occ restore");
	});

	// TC-7.8b: --quickstart flag prints quickstart text to stdout
	it("quickstart flag prints to stdout", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		// Run the command with quickstart flag
		// Cast to unknown to bypass citty's complex ParsedArgs type requirements
		await mainCommand.run?.({
			args: { quickstart: true, _: [] },
			rawArgs: [],
			cmd: mainCommand,
		} as unknown as Parameters<NonNullable<typeof mainCommand.run>>[0]);

		// Verify quickstart text was printed
		expect(consoleSpy).toHaveBeenCalledWith(QUICKSTART_TEXT);

		consoleSpy.mockRestore();
	});
});
