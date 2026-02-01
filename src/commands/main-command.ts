import { defineCommand } from "citty";
import { editCommand } from "./edit-command.js";
import { cloneCommand } from "./clone-command.js";
import { listCommand } from "./list-command.js";
import { infoCommand } from "./info-command.js";
import { restoreCommand } from "./restore-command.js";

/**
 * Quickstart help text (~250 tokens).
 */
export const QUICKSTART_TEXT = `
occ - OpenClaw Context Cleaner

TIP: Configure OpenClaw to show session ID in status line for easy access.

WHEN TO USE:
  Running low on context? Clean up old tool calls to keep working.

PRESETS:
  default     Keep 20 recent turns with tools, truncate half
  aggressive  Keep 10 recent turns, truncate half
  extreme     Remove all tool calls

COMMON COMMANDS:
  occ edit --strip-tools           Edit current session (auto-detect)
  occ edit abc123 --strip-tools    Edit specific session
  occ clone <id> --strip-tools     Clone instead of edit
  occ list                         Show available sessions
  occ info <id>                    Analyze session before cleaning
  occ restore <id>                 Undo last edit from backup

FLAGS:
  --json       Machine-readable output
  --verbose    Detailed statistics
  --help       Full documentation

WHAT HAPPENS:
  - Removes/truncates tool calls based on preset
  - Removes thinking blocks
  - Registers new session in OpenClaw (clone only)
`.trim();

export const mainCommand = defineCommand({
	meta: {
		name: "occ",
		description: "OpenClaw Context Cleaner - Clean session transcripts",
		version: "0.1.0",
	},
	args: {
		quickstart: {
			type: "boolean",
			description: "Show condensed agent-friendly help",
			default: false,
		},
	},
	subCommands: {
		edit: editCommand,
		clone: cloneCommand,
		list: listCommand,
		info: infoCommand,
		restore: restoreCommand,
	},
	async run({ args }) {
		if (args.quickstart) {
			console.log(QUICKSTART_TEXT);
			return;
		}

		// Default behavior: show help hint
		console.log("occ - OpenClaw Context Cleaner");
		console.log("");
		console.log("Usage: occ <command> [options]");
		console.log("");
		console.log("Commands:");
		console.log("  edit     Edit a session in place");
		console.log("  clone    Clone a session to a new file");
		console.log("  list     List available sessions");
		console.log("  info     Show session statistics");
		console.log("  restore  Restore session from backup");
		console.log("");
		console.log("Use 'occ --help' for full documentation");
		console.log("Use 'occ --quickstart' for agent-friendly quick reference");
	},
});
