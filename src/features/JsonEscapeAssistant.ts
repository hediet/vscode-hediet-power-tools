import { Disposable } from "@hediet/std/disposable";
import {
	languages,
	MarkdownString,
	commands,
	Range,
	TextDocument,
	window,
	env,
	Uri,
	workspace,
	ViewColumn,
} from "vscode";
import { parse } from "golden-fleece";
import { Literal, Value, Property } from "golden-fleece/types/interfaces";
import { VirtualFileSystemController } from "./FileSystemController";

const pasteCommand = "hediet-power-tools.jsonEscapeAssistant.paste";
const copyCommand = "hediet-power-tools.jsonEscapeAssistant.copy";
const editCommand = "hediet-power-tools.jsonEscapeAssistant.edit";

export class JsonEscapeAssistant {
	public readonly dispose = Disposable.fn();

	private readonly fileSystemController = this.dispose.track(
		new VirtualFileSystemController()
	);

	constructor() {
		let idx = 0;
		this.dispose.track([
			commands.registerCommand(copyCommand, async (offset: number) => {
				const editor = window.activeTextEditor;
				if (!editor) {
					return;
				}
				const info = this.getStringInfoAt(
					editor.document.getText(),
					offset
				);
				if (!info) {
					return;
				}
				await env.clipboard.writeText(info.value);
			}),
			commands.registerCommand(pasteCommand, async (offset: number) => {
				const editor = window.activeTextEditor;
				if (!editor) {
					return;
				}
				const info = this.getStringInfoAt(
					editor.document.getText(),
					offset
				);
				if (!info) {
					return;
				}
				const newValue = await env.clipboard.readText();
				await editor.edit((b) => {
					b.replace(
						this.rangeToVsCodeRange(editor.document, info.range),
						info.fromValue(newValue)
					);
				});
			}),
			commands.registerCommand(editCommand, async (offset: number) => {
				const editor = window.activeTextEditor;
				if (!editor) {
					return;
				}
				let editorOpened = true;

				const info = this.getStringInfoAt(
					editor.document.getText(),
					offset
				);
				if (!info) {
					return;
				}

				const uri = Uri.parse(
					`${
						this.fileSystemController.scheme
					}:/editor-${idx++}/${info.path.join("/")}.txt`
				);
				const {
					file,
				} = this.fileSystemController.getOrCreateFileForUri(uri);
				file.writeString(info.value);
				file.onBeforeDidChangeFile(
					async ({ getDataAsString, setError }) => {
						const root = parse(editor.document.getText());
						const item = findNodeAtPath(root, info.path);

						if (!editorOpened) {
							setError(
								new Error(
									`Target editor is not opened anymore!`
								)
							);
							return;
						}

						if (!item) {
							setError(
								new Error(
									`Path "${info.path.join(
										"/"
									)}" does not exist anymore in target document!`
								)
							);
							return;
						}

						await editor.edit((b) => {
							b.replace(
								this.rangeToVsCodeRange(editor.document, item),
								info.fromValue(getDataAsString())
							);
						});
					}
				);

				const doc = await workspace.openTextDocument(uri);
				const e = await window.showTextDocument(doc, ViewColumn.Beside);
				if (e) {
					const d = window.onDidChangeVisibleTextEditors(() => {
						const projectionEditorOpened = window.visibleTextEditors.some(
							(e) => e.document.uri.toString() === uri.toString()
						);
						editorOpened = window.visibleTextEditors.some(
							(e) => e === editor
						);
						if (!projectionEditorOpened) {
							d.dispose();
						}
					});
				}
			}),
		]);

		this.dispose.track(
			languages.registerHoverProvider(
				[
					{ language: "json" },
					{ language: "json5" },
					{ language: "jsonc" },
				],
				{
					provideHover: (document, position) => {
						const offset = document.offsetAt(position);
						const stringLiteralInfo = this.getStringInfoAt(
							document.getText(),
							offset
						);

						if (!stringLiteralInfo) {
							return;
						}

						const md = new MarkdownString();
						md.isTrusted = true;

						if (
							stringLiteralInfo.raw !==
							`"${stringLiteralInfo.value}"`
						) {
							const lines = stringLiteralInfo.value.split("\n");
							const firstLines = lines.splice(
								0,
								lines.length <= 4 ? 4 : 3
							);
							md.appendMarkdown("Unescaped text:");
							let text = firstLines.join("\n");
							if (lines.length > 0) {
								text += `\n... (${lines.length} more lines)`;
							}
							md.appendCodeblock(text, "text");
						}

						md.appendMarkdown(
							[
								`[copy](command:${copyCommand}?${encodeURIComponent(
									JSON.stringify([offset])
								)})`,
								`[paste](command:${pasteCommand}?${encodeURIComponent(
									JSON.stringify([offset])
								)})`,
								`[edit](command:${editCommand}?${encodeURIComponent(
									JSON.stringify([offset])
								)})`,
							].join(" - ")
						);

						return {
							contents: [md],
							range: this.rangeToVsCodeRange(
								document,
								stringLiteralInfo.range
							),
						};
					},
				}
			)
		);
	}

	private rangeToVsCodeRange(
		doc: TextDocument,
		range: { start: number; end: number }
	): Range {
		return new Range(
			doc.positionAt(range.start),
			doc.positionAt(range.end)
		);
	}

	private getStringInfoAt(
		src: string,
		offset: number
	):
		| {
				range: { start: number; end: number };
				fromValue: (val: string) => string;
				value: string;
				raw: string;
				path: string[];
		  }
		| undefined {
		const ast = parse(src);

		const n = findLiteralAt(offset, ast);
		if (!n) {
			return undefined;
		}

		const { literal, path } = n;
		if (typeof literal.value !== "string") {
			return undefined;
		}
		return {
			range: {
				start: literal.start,
				end: literal.end,
			},
			value: literal.value,
			fromValue: (val) => JSON.stringify(val),
			raw: literal.raw,
			path,
		};
	}
}

function findNodeAtPath(root: Value, path: string[]): Value | undefined {
	if (path.length === 0) {
		return root;
	}

	if (root.type === "ObjectExpression") {
		const key = path[0];
		const prop = root.properties.find((p) => getPropertyName(p) === key);
		if (!prop) {
			return undefined;
		}
		return findNodeAtPath(prop.value, path.slice(1));
	} else if (root.type === "ArrayExpression") {
		const idx = parseInt(path[0], 10);
		if (!Number.isInteger(idx)) {
			return undefined;
		}
		const val = root.elements[idx];
		if (!val) {
			return undefined;
		}
		return findNodeAtPath(val, path.slice(1));
	} else {
		if (path.length === 0) {
			return root;
		}
		return undefined;
	}
}

function getPropertyName(c: Property): string {
	return c.key.type === "Identifier" ? c.key.name : "" + c.key.value;
}

function findLiteralAt(
	offset: number,
	node: Value
): { literal: Literal; path: string[] } | undefined {
	if (node.type === "ObjectExpression") {
		for (const c of node.properties) {
			c.key;
			if (c.start <= offset && offset <= c.end) {
				const result = findLiteralAt(offset, c.value);
				if (result) {
					result.path.unshift(getPropertyName(c));
				}
				return result;
			}
		}
		return undefined;
	} else if (node.type === "ArrayExpression") {
		let idx = 0;
		for (const c of node.elements) {
			if (c.start <= offset && offset <= c.end) {
				const result = findLiteralAt(offset, c);
				if (result) {
					result.path.unshift(`${idx}`);
				}
				return result;
			}
			idx++;
		}
		return undefined;
	} else {
		return { literal: node, path: [] };
	}
}
