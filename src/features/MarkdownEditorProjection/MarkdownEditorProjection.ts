import { Disposable } from "@hediet/std/disposable";
import {
	DocumentSelector,
	languages,
	TextDocument,
	window,
	workspace,
} from "vscode";
import { MarkdownDocumentController } from "./MarkdownDocumentController";

export class MarkdownEditorProjection {
	public readonly dispose = Disposable.fn();

	private readonly controllers = new Map<
		TextDocument,
		MarkdownDocumentController
	>();

	constructor() {
		this.dispose.track([
			workspace.onDidOpenTextDocument((doc) => {
				this.processDoc(doc);
			}),
			workspace.onDidCloseTextDocument((doc) => {
				const c = this.controllers.get(doc);
				if (c) {
					this.controllers.delete(doc);
					c.dispose();
				}
			}),
		]);

		for (const doc of workspace.textDocuments) {
			this.processDoc(doc);
		}

		const selector: DocumentSelector = { language: "markdown" };

		this.dispose.track([
			languages.registerCompletionItemProvider(selector, {
				provideCompletionItems: async (
					document,
					position,
					token,
					context
				) => {
					const c = this.controllers.get(document);
					if (c) {
						return await c.provideCompletionItems(
							position,
							token,
							context
						);
					}
				},
			}),
			languages.registerDefinitionProvider(selector, {
				provideDefinition: async (document, position, token) => {
					const c = this.controllers.get(document);
					if (c) {
						return await c.provideDefinition(position, token);
					}
				},
			}),
			languages.registerSignatureHelpProvider(selector, {
				provideSignatureHelp: async (
					document,
					position,
					token,
					context
				) => {
					const c = this.controllers.get(document);
					if (c) {
						return await c.provideSignatureHelp(
							position,
							token,
							context
						);
					}
				},
			}),
		]);
	}

	private readonly codeBlockDecoration = this.dispose.track(
		window.createTextEditorDecorationType({
			backgroundColor: "red",
		})
	);

	private processDoc(doc: TextDocument) {
		if (doc.languageId !== "markdown") {
			return;
		}
		const c = new MarkdownDocumentController(doc);
		this.controllers.set(doc, c);
		/*
		c.dispose.track({
			dispose: autorun(() => {
				for (const editor of window.visibleTextEditors) {
					if (editor.document !== doc) {
						continue;
					}

					editor.setDecorations(
						this.codeBlockDecoration,
						c.blocks.map((b) => b.contentRange)
					);
				}
			}),
		});*/
	}
}
