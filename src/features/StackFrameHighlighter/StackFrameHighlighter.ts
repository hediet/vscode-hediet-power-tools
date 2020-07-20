import { Disposable } from "@hediet/std/disposable";
import { Deferred } from "@hediet/std/synchronization";
import { vsCodeDebuggerView } from "./VSCodeDebugger";
import { autorun, observable } from "mobx";
import {
	window,
	ThemeColor,
	DecorationOptions,
	TextEditor,
	MarkdownString,
	commands,
} from "vscode";
// import * as gradient from "gradient-color";

const stepOutCommand = "hediet-power-tools.stackFrameLineHighlighter.stepOut";

export class StackFrameLineHighlighter {
	public readonly dispose = Disposable.fn();

	private readonly vsCodeDebuggerView = vsCodeDebuggerView;

	private readonly decoration = this.dispose.track(
		window.createTextEditorDecorationType({
			isWholeLine: true,
			backgroundColor: new ThemeColor(
				"diffEditor.insertedTextBackground"
			),
			after: {
				color: new ThemeColor("editorCodeLens.foreground"),
				margin: "20px",
			},
		})
	);

	@observable visibleTextEditors: TextEditor[] = window.visibleTextEditors;

	constructor() {
		this.dispose.track(
			window.onDidChangeVisibleTextEditors((editors) => {
				this.visibleTextEditors = editors;
			})
		);

		if (false) {
			// https://github.com/microsoft/vscode/issues/102939
			this.dispose.track(
				commands.registerCommand(stepOutCommand, async (frameId) => {
					const s = this.vsCodeDebuggerView.activeDebugSession;
					if (!s) {
						return;
					}
					const deferred = new Deferred();
					const d = s.onStopped.sub(
						async ({ stackFrames, threadId }) => {
							if (stackFrames.every((f) => f.id !== frameId)) {
								deferred.resolve();
							} else {
								await s.session.customRequest("stepOut", {
									threadId,
								});
							}
						}
					);
					await deferred;
					d.dispose();
				})
			);
		}

		this.dispose.track({
			dispose: autorun(() => {
				let activeStackFrames = this.vsCodeDebuggerView
					.debouncedActiveStackFrames;

				let mappedStackFrames: {
					path: string;
					line: number;
					stackFramesUp: number;
					frameId: number;
				}[];
				if (activeStackFrames) {
					mappedStackFrames = activeStackFrames
						.filter((frame) => frame.source !== undefined)
						.map((frame, idx) => ({
							path: frame.source!.path,
							line: frame.line,
							stackFramesUp: idx,
							frameId: frame.id,
						}))
						.slice(1);
				} else {
					mappedStackFrames = [];
				}

				for (const editor of this.visibleTextEditors) {
					const stackFramesForEditor = mappedStackFrames.filter(
						(s) => s.path === editor.document.fileName
					);

					const stackFramesByLine = groupBy(
						stackFramesForEditor,
						(s) => s.line
					);

					const decorations = [...stackFramesByLine].map(
						([line, frames]) => ({
							line,
							stackFramesUp: frames
								.map((f) => f.stackFramesUp)
								.reduce(
									(a, b) => Math.min(a, b),
									Number.MAX_SAFE_INTEGER
								),
							recursionCount: frames.length,
							latestFrameId: frames[frames.length - 1].frameId,
						})
					);

					/*const colors = gradient.default(
						["#403c00", "#fffbbf"],
						Math.max(decorations.length, 3)
					);*/

					function getHoverMessage(
						frameId: number
					): MarkdownString | undefined {
						return undefined;
						// https://github.com/microsoft/vscode/issues/102939
						const m = new MarkdownString("hello world");
						m.isTrusted = true;
						m.appendMarkdown(
							`[Step Out](command:${stepOutCommand}?${encodeURIComponent(
								JSON.stringify([frameId])
							)})`
						);
						return m;
					}

					editor.setDecorations(
						this.decoration,
						decorations.map<DecorationOptions>((d, idx) => ({
							range: editor.document.lineAt(d.line - 1).range,
							hoverMessage: getHoverMessage(d.latestFrameId),
							renderOptions: {
								after: {
									//backgroundColor: colors[idx],
									//color: "white",

									contentText:
										`${
											d.stackFramesUp
										} Stack Frame${pluralS(
											d.stackFramesUp
										)} up` +
										(d.recursionCount !== 1
											? `, ${ordinal_suffix_of(
													d.recursionCount
											  )} Recursion`
											: ""),
								},
							},
						}))
					);
				}
			}),
		});
	}
}

export function groupBy<T, TKey>(
	items: ReadonlyArray<T>,
	keySelector: (item: T) => TKey
): Map<TKey, T[]> {
	const map = new Map<TKey, T[]>();
	for (const item of items) {
		const key = keySelector(item);
		let items = map.get(key);
		if (!items) {
			items = [];
			map.set(key, items);
		}
		items.push(item);
	}
	return map;
}

function pluralS(i: number): string {
	if (i === 1) {
		return "";
	}
	return "s";
}

function ordinal_suffix_of(i: number): string {
	var j = i % 10,
		k = i % 100;
	if (j == 1 && k != 11) {
		return i + "st";
	}
	if (j == 2 && k != 12) {
		return i + "nd";
	}
	if (j == 3 && k != 13) {
		return i + "rd";
	}
	return i + "th";
}
