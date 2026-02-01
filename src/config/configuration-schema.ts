import { z } from "zod";

export const ToolRemovalPresetSchema = z.object({
	name: z.string(),
	keepTurnsWithTools: z.number().int().min(0),
	truncatePercent: z.number().min(0).max(100),
});

export const UserConfigurationSchema = z.object({
	stateDirectory: z.string().optional(),
	defaultAgentId: z.string().optional(),
	defaultPreset: z.string().optional(),
	customPresets: z.record(ToolRemovalPresetSchema).optional(),
	outputFormat: z.enum(["human", "json"]).optional(),
	verboseOutput: z.boolean().optional(),
});

export type ValidatedUserConfiguration = z.infer<
	typeof UserConfigurationSchema
>;
