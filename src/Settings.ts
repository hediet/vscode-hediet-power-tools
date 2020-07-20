import { VsCodeSetting, serializerWithDefault } from "./VsCodeSetting";

export class Settings {
	public readonly applyRenameEnabled = new VsCodeSetting(
		"hediet-power-tools.applyRename.enabled",
		{ serializer: serializerWithDefault<boolean>(true) }
	);

	public readonly applyRenameTheme = new VsCodeSetting(
		"hediet-power-tools.applyRename.theme",
		{ serializer: serializerWithDefault<"dashed" | "colored">("dashed") }
	);

	public readonly jsonEscapeAssistantEnabled = new VsCodeSetting(
		"hediet-power-tools.jsonEscapeAssistant.enabled",
		{ serializer: serializerWithDefault<boolean>(true) }
	);

	public readonly stackFrameLineHighlighterEnabled = new VsCodeSetting(
		"hediet-power-tools.stackFrameLineHighlighter.enabled",
		{ serializer: serializerWithDefault<boolean>(true) }
	);

	public readonly customDefinitionsEnabled = new VsCodeSetting(
		"hediet-power-tools.customDefinitions.enabled",
		{ serializer: serializerWithDefault<boolean>(false) }
	);

	public readonly debugAdapterLoggerEnabled = new VsCodeSetting(
		"hediet-power-tools.debugAdapterLogger.enabled",
		{ serializer: serializerWithDefault<boolean>(false) }
	);
}
