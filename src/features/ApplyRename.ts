import { Disposable } from "@hediet/std/disposable";
import {
	workspace,
	TextDocumentChangeEvent,
	window,
	TextEditorSelectionChangeEvent,
	TextDocument,
	Range,
	WorkspaceEdit,
	commands,
	StatusBarAlignment,
	languages,
	ThemeColor,
} from "vscode";
import {
	executeDocumentHighlights,
	setContext,
	renameMany,
	Rename,
} from "../vscode-api";
import { Settings } from "../Settings";
import { autorun } from "mobx";

const applyRenameCommandName = "hediet-power-tools.apply-rename";
const applyRenameApplicable = "hediet-power-tools.apply-rename.applicable";
const applyRenameCancelable = "hediet-power-tools.apply-rename.cancelable";
const abortRenameSession = "hediet-power-tools.abort-rename-session";

export class ChangeTracker {
	public readonly dispose = Disposable.fn();

	private readonly themes = {
		dashed: this.dispose.track(
			window.createTextEditorDecorationType({
				dark: {
					border: "dashed lightgrey",
				},

				border: "dashed black",
				borderWidth: "1px 1px 1px 1px",
			})
		),
		colored: this.dispose.track(
			window.createTextEditorDecorationType({
				backgroundColor: new ThemeColor(
					"peekViewEditor.matchHighlightBackground"
				),
			})
		),
	};

	private highlight = this.themes.dashed;

	private readonly statusBarItem = this.dispose.track(
		window.createStatusBarItem(StatusBarAlignment.Left, 10000)
	);

	private tracker: TextChangeTracker | undefined = (global as any)
		.lastTracker;
	private ignoreChanges = false;

	constructor(settings: Settings) {
		this.dispose.track([
			{
				dispose: autorun(() => {
					this.highlight = this.themes[
						settings.applyRenameTheme.get()
					];
					this.updateUI();
				}),
			},
			workspace.onDidChangeTextDocument((e) => this.handleTextChange(e)),
			window.onDidChangeTextEditorSelection((e) =>
				this.handleSelectionChange(e)
			),
			commands.registerCommand(applyRenameCommandName, () =>
				this.renameSelectedModifiedIdentifiers()
			),
			commands.registerCommand(abortRenameSession, () => {
				this.tracker = undefined;
				this.updateUI();
			}),
			languages.registerCodeActionsProvider(
				{ pattern: "**/*" },
				{
					provideCodeActions: (doc, range, context, meta) => {
						if (!this.tracker || this.tracker.document !== doc) {
							return [];
						}
						if (!this.tracker.getTrackedSpanAt(range)) {
							return [];
						}
						return [
							{
								title: "Apply Rename",
								isPreferred: true,
								command: applyRenameCommandName,
							},
						];
					},
				}
			),
		]);
		this.updateUI();
	}

	private async renameSelectedModifiedIdentifiers(): Promise<void> {
		if (!this.tracker) {
			return;
		}

		const spansToRename = this.activeTrackers;

		this.ignoreChanges = true;
		try {
			const edit = new WorkspaceEdit();
			const doc = this.tracker.document;

			console.debug(
				"Renaming " +
					spansToRename.map((s) => `${s.originalText} => ${s.text}`)
			);

			edit.replace(
				doc.uri,
				new Range(0, 0, doc.lineCount, 0),
				this.tracker.originalDocText
			);
			await workspace.applyEdit(edit);

			const renames = spansToRename.map(
				(trackedSpan) =>
					({
						uri: doc.uri,
						newName: trackedSpan.text,
						range: new Range(
							doc.positionAt(trackedSpan.originalStart),
							doc.positionAt(
								trackedSpan.originalStart +
									trackedSpan.originalText.length
							)
						),
					} as Rename)
			);
			await renameMany(renames);
		} finally {
			this.tracker = undefined;
			this.ignoreChanges = false;
			this.updateUI();

			if (window.activeTextEditor) {
				this.handleSelectionChange({
					selections: window.activeTextEditor.selections,
					textEditor: window.activeTextEditor,
				});
			}
		}
	}

	private get activeTrackers(): TrackedSpan[] {
		return this.selectedTrackers;
	}

	private get selectedTrackers(): TrackedSpan[] {
		const result = new Array<TrackedSpan>();
		for (const editor of window.visibleTextEditors) {
			const tracker = this.tracker;
			if (tracker && editor.document === tracker.document) {
				for (const s of editor.selections.map((s) =>
					tracker.getTrackedSpanAt(s)
				)) {
					if (s && s.changed) {
						result.push(s);
					}
				}
			}
		}
		return result;
	}

	private updateUI(): void {
		for (const editor of window.visibleTextEditors) {
			if (this.tracker && editor.document === this.tracker.document) {
				editor.setDecorations(
					this.highlight,
					this.activeTrackers.map(
						(t) =>
							new Range(
								editor.document.positionAt(t.start),
								editor.document.positionAt(t.end)
							)
					)
				);
			} else {
				editor.setDecorations(this.highlight, []);
			}
		}

		if (this.tracker && this.activeTrackers.length > 0) {
			setContext(applyRenameApplicable, this.selectedTrackers.length > 0);
			setContext(applyRenameCancelable, true);

			this.statusBarItem.command = applyRenameCommandName;
			this.statusBarItem.text = `$(edit) Rename ${this.activeTrackers.length} changes`;
			this.statusBarItem.show();
		} else {
			setContext(applyRenameApplicable, false);
			setContext(applyRenameCancelable, false);
			this.statusBarItem.hide();
		}
	}

	private async handleTextChange(e: TextDocumentChangeEvent): Promise<void> {
		if (this.ignoreChanges) {
			return;
		}

		if (!this.tracker || e.document !== this.tracker.document) {
			this.tracker = new TextChangeTracker(e.document);
		}

		const doc = e.document;

		const changes = e.contentChanges.slice(0);
		changes.sort(
			(c1, c2) =>
				doc.offsetAt(c2.range.start) - doc.offsetAt(c1.range.start)
		);

		for (const c of changes) {
			const start = c.rangeOffset;
			const end = start + c.rangeLength;
			const { shouldAbortSession } = this.tracker.acceptChange(
				{ start, end },
				c.text
			);
			if (shouldAbortSession) {
				this.tracker = new TextChangeTracker(e.document);
				break;
			}
		}

		this.updateUI();
	}

	private async handleSelectionChange(e: TextEditorSelectionChangeEvent) {
		setContext(applyRenameApplicable, this.selectedTrackers.length > 0);

		if (this.ignoreChanges) {
			return;
		}

		const doc = e.textEditor.document;
		if (!this.tracker || e.textEditor.document !== this.tracker.document) {
			this.tracker = new TextChangeTracker(e.textEditor.document);
		}

		for (const selection of e.selections) {
			let highlights = await executeDocumentHighlights(
				e.textEditor.document.uri,
				selection.start
			);
			if (!highlights) {
				highlights = [];
			}

			const highlightAtSelection = highlights.filter((h) =>
				h.range.contains(selection.start)
			)[0];

			if (highlightAtSelection) {
				const start = doc.offsetAt(highlightAtSelection.range.start);
				const end = doc.offsetAt(highlightAtSelection.range.end);
				this.tracker.trackRange({ start, end });
			}
		}

		this.updateUI();
	}
}

class TextChangeTracker {
	public readonly trackedSpans = new Array<TrackedSpan>();

	public get changedTrackedSpans(): TrackedSpan[] {
		return this.trackedSpans.filter((s) => s.changed);
	}

	public readonly originalDocText: string;

	constructor(public readonly document: TextDocument) {
		this.originalDocText = document.getText();
		(global as any).lastTracker = this;
	}

	public getTrackedSpanAt(range: Range): TrackedSpan | undefined {
		const start = this.document.offsetAt(range.start);
		// const end = this.document.offsetAt(range.end);
		return this.changedTrackedSpans.find((s) => s.contains(start));
	}

	public trackRange(rangeToTrack: {
		start: number;
		end: number;
	}): TrackedSpan {
		const existing = this.trackedSpans.find((span) =>
			span.contains(rangeToTrack.start)
		);
		if (existing) {
			return existing;
		}

		const text = this.document.getText(
			new Range(
				this.document.positionAt(rangeToTrack.start),
				this.document.positionAt(rangeToTrack.end)
			)
		);

		let deltaToOriginal = 0;
		for (const trackedSpan of this.trackedSpans) {
			if (trackedSpan.end < rangeToTrack.start) {
				deltaToOriginal += trackedSpan.deltaToOriginal;
			}
		}

		const newSpan = new TrackedSpan(
			rangeToTrack.start,
			text,
			rangeToTrack.start - deltaToOriginal
		);
		this.trackedSpans.push(newSpan);
		return newSpan;
	}

	public acceptChange(
		range: { start: number; end: number },
		newValue: string
	): { shouldAbortSession: boolean } {
		const changedSpan = this.trackedSpans.find(
			(t) => t.contains(range.start) && t.contains(range.end)
		);

		if (!changedSpan) {
			return { shouldAbortSession: true };
		}

		if (!newValue.match(/^[a-zA-Z_0-9-]*$/)) {
			return { shouldAbortSession: true };
		}

		const deleteLength = range.end - range.start;
		const addLength = newValue.length;
		const delta = addLength - deleteLength;

		changedSpan.applyEdit(
			range.start - changedSpan.start,
			range.end - changedSpan.start,
			newValue
		);

		for (const span of this.trackedSpans) {
			if (span.start > changedSpan.end) {
				span.move(delta);
			}
		}
		return { shouldAbortSession: false };
	}
}

class TrackedSpan {
	public get changed(): boolean {
		return this.text != this.originalText;
	}

	public get end(): number {
		return this.start + this.text.length;
	}

	public text = this.originalText;

	constructor(
		public start: number,
		public readonly originalText: string,
		public readonly originalStart: number
	) {}

	public get deltaToOriginal(): number {
		return this.text.length - this.originalText.length;
	}

	public contains(pos: number): boolean {
		return this.start <= pos && pos <= this.start + this.text.length;
	}

	public move(delta: number): void {
		this.start += delta;
	}

	public applyEdit(start: number, end: number, newText: string): void {
		const startStr = this.text.substr(0, start);
		const endStr = this.text.substr(end);
		this.text = startStr + newText + endStr;
	}
}
