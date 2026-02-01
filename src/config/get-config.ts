import type { ResolvedConfiguration } from "../types/index.js";
import { loadConfiguration } from "./configuration-loader.js";

// Global config instance (loaded once at startup)
let resolvedConfig: ResolvedConfiguration | null = null;

/**
 * Get the resolved configuration.
 * Lazy-loads on first access.
 */
export async function getConfig(): Promise<ResolvedConfiguration> {
	if (!resolvedConfig) {
		resolvedConfig = await loadConfiguration();
	}
	return resolvedConfig;
}

/**
 * Reset the configuration singleton.
 * Useful for testing to ensure fresh config on each test.
 */
export function resetConfig(): void {
	resolvedConfig = null;
}
