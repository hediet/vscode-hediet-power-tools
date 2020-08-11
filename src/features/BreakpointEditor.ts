import { Disposable } from "@hediet/std/disposable";
import * as vscode from "vscode";
import { VirtualFileSystemController } from "./FileSystemController";

export class BreakpointEditor {
	public readonly dispose = Disposable.fn();

	private readonly fileSystemController = this.dispose.track(
		new VirtualFileSystemController("hediet-power-tools")
	);

	constructor() {
		this.init();
	}

	private async init(): Promise<void> {
		const uri = vscode.Uri.parse(
			`${this.fileSystemController.scheme}:/breakpoints.txt`
		);
		const { file } = this.fileSystemController.getOrCreateFileForUri(uri);

		const doc = await vscode.workspace.openTextDocument(file.uri);
		await vscode.window.showTextDocument(doc);

		let lastEditor: vscode.TextEditor | undefined;

		this.dispose.track(
			vscode.window.onDidChangeActiveTextEditor(async (editor) => {
				if (!editor) {
					return;
				}
				if (editor.document !== doc) {
					file.writeString("\n".repeat(editor.document.lineCount));
					lastEditor = editor;
				}
			})
		);

		this.dispose.track(
			vscode.debug.onDidChangeBreakpoints((e) => {
				/*console.log(e);
				console.log(JSON.stringify(vscode.debug.breakpoints));*/

				
			})
		);

		this.dispose.track(
			vscode.workspace.onDidChangeTextDocument(async (e) => {
				if (e.document !== doc) {
					return;
				}

				if (!lastEditor) {
					return;
				}
				const breakpoints = new Array<vscode.Breakpoint>();
				const lines = e.document.getText();
				let idx = 0;
				for (const line of lines.split("\n")) {
					if (line.startsWith("#")) {
						let content: string | undefined = line.substr(1).trim();
						// # Hello World ? foo=1

						const lineRange = lastEditor.document.lineAt(idx).range;

						const parts = content.split("?", 2);
						function normalize(
							str: string | undefined
						): string | undefined {
							if (str === undefined) {
								return undefined;
							}
							const result = str.trim();
							if (result === "") {
								return undefined;
							}
							return result;
						}
						const logMessage = normalize(parts[0]);
						const condition = normalize(parts[1]);

						breakpoints.push(
							new vscode.SourceBreakpoint(
								new vscode.Location(
									lastEditor.document.uri,
									new vscode.Range(
										lineRange.start,
										lineRange.start
									)
								),
								true,
								condition,
								undefined,
								logMessage
							)
						);
					}
					idx++;
				}

				vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
				vscode.debug.addBreakpoints(breakpoints);
			})
		);

		this.dispose.track(
			vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
				if (e.textEditor.document === doc) {
					return;
				}

				const breakpointEditor = vscode.window.visibleTextEditors.find(
					(e) => e.document === doc
				);
				if (breakpointEditor) {
					breakpointEditor.revealRange(
						e.visibleRanges[0],
						vscode.TextEditorRevealType.AtTop
					);
				}

				//e.visibleRanges.uia
			})
		);
	}
}
