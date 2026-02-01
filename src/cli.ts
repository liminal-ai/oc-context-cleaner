#!/usr/bin/env node
import { runMain } from "citty";
import { mainCommand } from "./commands/main-command.js";

// Re-export getConfig for backward compatibility
export { getConfig } from "./config/get-config.js";

// Run the CLI
runMain(mainCommand);
