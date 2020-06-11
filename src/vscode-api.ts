import {
	WorkspaceEdit,
	workspace,
	Uri,
	commands,
	Range,
	Position,
	DocumentHighlight,
} from "vscode";

export async function renameMany(renames: Rename[]): Promise<void> {
	const edit = new WorkspaceEdit();
	for (const r of renames) {
		const result: WorkspaceEdit = await rename(r);
		// TODO how to combine file renames?
		for (const [uri, changes] of result.entries()) {
			for (const c of changes) {
				edit.replace(uri, c.range, c.newText);
			}
		}
	}
	await workspace.applyEdit(edit);
}

export async function rename(rename: Rename): Promise<WorkspaceEdit> {
	return (await commands.executeCommand(
		"vscode.executeDocumentRenameProvider",
		rename.uri,
		rename.range.start,
		rename.newName
	)) as any;
}

export async function setContext(
	key: string,
	value: string | boolean
): Promise<WorkspaceEdit> {
	return (await commands.executeCommand("setContext", key, value)) as any;
}

export async function executeDocumentHighlights(
	uri: Uri,
	position: Position
): Promise<DocumentHighlight[]> {
	return (await commands.executeCommand(
		"vscode.executeDocumentHighlights",
		uri,
		position
	)) as any;
}

export interface Rename {
	uri: Uri;
	range: Range;
	newName: string;
}
