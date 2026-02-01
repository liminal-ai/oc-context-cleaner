import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { serializeToJsonl } from "../core/session-parser.js";
import type { SessionEntry } from "../types/index.js";

/**
 * Write session entries to a file atomically.
 *
 * Uses temp file + rename for atomicity.
 *
 * @param filePath Target file path
 * @param entries Session entries to write
 */
export async function writeSessionFile(
	filePath: string,
	entries: SessionEntry[],
): Promise<void> {
	const content = serializeToJsonl(entries);
	const dir = dirname(filePath);
	const tempPath = join(dir, `.tmp-${randomUUID()}.jsonl`);

	try {
		await writeFile(tempPath, content, "utf-8");
		await rename(tempPath, filePath);
	} catch (error) {
		// Clean up temp file on failure
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}

/**
 * Copy a file atomically.
 *
 * @param sourcePath Source file path
 * @param destPath Destination file path
 */
export async function copyFileAtomic(
	sourcePath: string,
	destPath: string,
): Promise<void> {
	const content = await readFile(sourcePath);
	const dir = dirname(destPath);
	const tempPath = join(dir, `.tmp-${randomUUID()}`);

	try {
		await writeFile(tempPath, content);
		await rename(tempPath, destPath);
	} catch (error) {
		try {
			await unlink(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw error;
	}
}
