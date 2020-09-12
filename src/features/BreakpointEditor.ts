import { Disposable, TrackFunction } from "@hediet/std/disposable";
import { autorun, computed, observable, runInAction } from "mobx";
import * as vscode from "vscode";
import { VirtualFileSystemController } from "./FileSystemController";
import { fromResource } from "./utils/fromResource";

class LastEditorSource {
	public readonly dispose = Disposable.fn();

	@observable public lastEditor: vscode.TextEditor | undefined = undefined;

	constructor(allowEditor: (editor: vscode.TextEditor) => boolean) {
		this.dispose.track(
			vscode.window.onDidChangeActiveTextEditor(async (editor) => {
				if (!editor || !allowEditor(editor)) {
					return;
				}
				this.lastEditor = editor;
			})
		);
	}
}

class EditorState {
	private readonly lineCountResource = fromResource<number>(
		(sink) =>
			vscode.workspace.onDidChangeTextDocument((e) => {
				if (e.document === this.editor.document) {
					sink(e.document.lineCount);
				}
			}),
		this.editor.document.lineCount
	);

	private readonly activeSelectionResource = fromResource<
		{ lineStart: number; lineEnd: number }[]
	>((sink) => {
		sink(this.fromSelection());
		return vscode.window.onDidChangeTextEditorSelection((e) => {
			if (e.textEditor === this.editor) {
				sink(this.fromSelection());
			}
		});
	}, this.fromSelection());

	private fromSelection(): { lineStart: number; lineEnd: number }[] {
		return this.editor.selections.map((s) => ({
			lineStart: s.start.line,
			lineEnd: s.end.line,
		}));
	}

	private readonly breakpoints = fromResource<DocumentBreakpoint[]>(
		(sink) => {
			sink(this.getBreakpoints());
			return vscode.debug.onDidChangeBreakpoints((e) => {
				sink(this.getBreakpoints());
			});
		},
		this.getBreakpoints()
	);

	private getBreakpoints(): DocumentBreakpoint[] {
		const breakpoints = vscode.debug.breakpoints.filter(
			(b) =>
				b instanceof vscode.SourceBreakpoint &&
				b.location.uri.toString() ===
					this.editor.document.uri.toString()
		);
		return breakpoints.map((b) => ({
			condition: b.condition,
			logMessage: b.logMessage,
			line: (b as vscode.SourceBreakpoint).location.range.start.line,
		}));
	}

	//public readonly breakpoints: IResource<DocumentBreakpoint[]>,
	//public readonly topVisibleLine: IResource<>

	constructor(private readonly editor: vscode.TextEditor) {}

	@computed
	public get content(): string {
		const text = buildText(
			this.lineCountResource.current(),
			this.breakpoints.current()
		);
		(global as any).foo = text;
		return text;
	}

	@computed.struct
	public get activeSelection(): { lineStart: number; lineEnd: number }[] {
		return this.activeSelectionResource.current();
	}

	//public currentlySelectedLine: number | undefined;
	//public topVisibleLine: number;

	public get targetUri(): vscode.Uri {
		return this.editor.document.uri;
	}
}

export class BreakpointEditor {
	public readonly dispose = Disposable.fn();

	private readonly fileSystemController = this.dispose.track(
		new VirtualFileSystemController("hediet-power-tools")
	);

	private readonly lastEditorSource = this.dispose.track(
		new LastEditorSource(
			(editor) => !editor.document.fileName.endsWith("breakpoints")
		)
	);

	constructor() {
		this.init();
	}

	@computed
	private get breakpointEditorState(): EditorState | undefined {
		const editor = this.lastEditorSource.lastEditor;
		if (!editor) {
			return undefined;
		}
		return new EditorState(editor);
	}

	private readonly decorationType = vscode.window.createTextEditorDecorationType(
		{
			backgroundColor: new vscode.ThemeColor(
				"editor.selectionHighlightBackground"
			),
			isWholeLine: true,
		}
	);

	private async init(): Promise<void> {
		const uri = vscode.Uri.parse(
			`${this.fileSystemController.scheme}:/breakpoints`
		);
		const { file } = this.fileSystemController.getOrCreateFileForUri(uri);

		const doc = await vscode.workspace.openTextDocument(file.uri);
		await vscode.window.showTextDocument(doc);

		let tasks = new Array<() => Promise<any>>();
		function schedule(task: () => Promise<any>) {
			tasks.push(() =>
				task().then(() => {
					tasks.shift();
					if (tasks.length > 0) {
						tasks[0]();
					}
				})
			);
			if (tasks.length === 1) {
				tasks[0]();
			}
		}

		autorunTrackDisposables((track) => {
			const state = this.breakpointEditorState;
			if (!state) {
				return;
			}

			const content = state.content;

			for (const editor of vscode.window.visibleTextEditors.filter(
				(e) => e.document === doc
			)) {
				if (editor.document.getText() !== content) {
					schedule(
						async () =>
							await editor.edit((b) =>
								b.replace(
									new vscode.Range(
										new vscode.Position(0, 0),
										new vscode.Position(
											editor.document.lineCount + 1,
											0
										)
									),
									content
								)
							)
					);
				}

				editor.setDecorations(
					this.decorationType,
					state.activeSelection.map(
						(s) =>
							new vscode.Range(
								new vscode.Position(s.lineStart, 0),
								new vscode.Position(s.lineEnd, 0)
							)
					)
				);
			}

			track(
				vscode.workspace.onDidChangeTextDocument(async (e) => {
					if (e.document !== doc) {
						return;
					}

					doc.save();

					const documentBreakpoints = parseText(e.document.getText());

					const breakpoints = documentBreakpoints.map((b) => {
						const pos = new vscode.Position(b.line, 0);
						return new vscode.SourceBreakpoint(
							new vscode.Location(
								state.targetUri,
								new vscode.Range(pos, pos)
							),
							true,
							b.condition,
							undefined,
							b.logMessage
						);
					});

					runInAction(() => {
						vscode.debug.removeBreakpoints(
							vscode.debug.breakpoints
						);
						vscode.debug.addBreakpoints(breakpoints);
					});
				})
			);
		});

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
			})
		);
	}
}

function autorunTrackDisposables(
	reaction: (track: TrackFunction) => void
): Disposable {
	let lastDisposable: Disposable | undefined;
	return {
		dispose: autorun(() => {
			if (lastDisposable) {
				lastDisposable.dispose();
			}
			lastDisposable = Disposable.fn(reaction);
		}),
	};
}

interface DocumentBreakpoint {
	line: number;
	condition: string | undefined;
	logMessage: string | undefined;
}

function parseText(text: string): DocumentBreakpoint[] {
	const breakpoints = new Array<DocumentBreakpoint>();
	const lines = text.split("\n");
	for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
		const line = lines[lineIdx];

		if (!line.startsWith(".")) {
			continue;
		}

		let content: string | undefined = line.substr(1).trim();
		// . Hello World ? foo=1

		const parts = content.split("?", 2);
		function normalize(str: string | undefined): string | undefined {
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
		/*
			const lineStart = new vscode.Position(lineIdx, 0);
			new vscode.Range(
				lineStart,
				lineStart
			)*/

		breakpoints.push({
			condition,
			logMessage,
			line: lineIdx,
		});
	}

	return breakpoints;
}

function buildText(
	documentLineCount: number,
	breakpoints: DocumentBreakpoint[]
): string {
	let result = "";
	for (let i = 0; i < documentLineCount; i++) {
		const b = breakpoints.find((b) => b.line === i);
		if (b) {
			result += ".";
		}
		result += "\n";
	}
	return result;
}
