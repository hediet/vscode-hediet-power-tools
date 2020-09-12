import {
	commands,
	CompletionList,
	Location,
	LocationLink,
	Position,
	SignatureHelp,
	Uri,
} from "vscode";

export async function executeCompletionItemProvider(
	uri: Uri,
	position: Position,
	triggerCharacter?: string
): Promise<CompletionList> {
	const result: any = await commands.executeCommand(
		"vscode.executeCompletionItemProvider",
		uri,
		position,
		triggerCharacter
	);
	return result;
}

export async function executeDefinitionProvider(
	uri: Uri,
	position: Position
): Promise<LocationLink[]> {
	const result: any = await commands.executeCommand(
		"vscode.executeDefinitionProvider",
		uri,
		position
	);
	return result;
}

export async function executeSignatureHelpProvider(
	uri: Uri,
	position: Position,
	triggerCharacter?: string
): Promise<SignatureHelp | undefined> {
	const result: any = await commands.executeCommand(
		"vscode.executeSignatureHelpProvider",
		uri,
		position,
		triggerCharacter
	);
	return result;
}
