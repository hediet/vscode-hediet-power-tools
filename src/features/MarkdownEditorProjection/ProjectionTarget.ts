import { Disposable } from "@hediet/std/disposable";
import {
	languages,
	workspace,
	Range,
	Uri,
	Position,
	TextDocument,
	CancellationToken,
	CompletionContext,
	CompletionList,
	TextEdit,
	SignatureHelpContext,
	SignatureHelp,
	Diagnostic,
	LocationLink,
} from "vscode";
import {
	executeCompletionItemProvider,
	executeDefinitionProvider,
	executeSignatureHelpProvider,
} from "../utils/vscode-api";
import { CodeBlock } from "./CodeBlock";
import { addSegmentToUri, getParentUri } from "./MarkdownDocumentController";

export interface ProjectionTargetOptions {
	id: string;
	language: string;
	extension?: string;
}

export class ProjectionTarget {
	public readonly dispose = Disposable.fn();

	private readonly dirUri = addSegmentToUri(
		getParentUri(this.parentUri),
		".tmp-projections"
	);

	private initialized = false;

	public block!: CodeBlock;

	private readonly uri = addSegmentToUri(
		this.dirUri,
		this.options.id +
			"." +
			(this.options.extension || this.options.language)
	);

	private doc: TextDocument | undefined;

	constructor(
		public readonly parentUri: Uri,
		public readonly options: ProjectionTargetOptions
	) {
		this.dispose.track({
			dispose: () => {
				if (this.initialized) {
					workspace.fs.delete(this.uri);
				}
			},
		});

		// This keeps the document alive.
		this.dispose.track(
			workspace.onDidCloseTextDocument(async (doc) => {
				if (doc === this.doc) {
					this.doc = await workspace.openTextDocument(this.uri);
				}
			})
		);
	}

	public async update(block: CodeBlock): Promise<void> {
		this.block = block;
		if (!this.initialized) {
			await workspace.fs.createDirectory(this.dirUri);
			this.initialized = true;
		}
		await workspace.fs.writeFile(
			this.uri,
			Buffer.from(block.content, "utf-8")
		);

		if (!this.doc) {
			this.doc = await workspace.openTextDocument(this.uri);
		}
	}

	public translatePosition(pos: Position): Position {
		const start = this.block.contentRange.start;
		return new Position(pos.line - start.line, pos.character);
	}

	public translateBackPosition(pos: Position): Position {
		const start = this.block.contentRange.start;
		return new Position(pos.line + start.line, pos.character);
	}

	public translateBackRange(range: Range): Range {
		return new Range(
			this.translateBackPosition(range.start),
			this.translateBackPosition(range.end)
		);
	}

	public async provideCompletionItems(
		position: Position,
		token: CancellationToken,
		context: CompletionContext
	): Promise<CompletionList> {
		const result = await executeCompletionItemProvider(
			this.uri,
			this.translatePosition(position),
			context.triggerCharacter
		);

		return new CompletionList(
			result.items.map((i) => {
				i = { ...i };

				if (i.range) {
					if ("inserting" in i.range) {
						i.range = {
							inserting: this.translateBackRange(
								i.range.inserting
							),
							replacing: this.translateBackRange(
								i.range.replacing
							),
						};
					} else {
						i.range = this.translateBackRange(i.range);
					}
				}

				if (i.textEdit) {
					i.textEdit = new TextEdit(
						this.translateBackRange(i.textEdit.range),
						i.textEdit.newText
					);
				}

				return i;
			}),
			result.isIncomplete
		);
	}

	public async provideDefinition(
		position: Position,
		token: CancellationToken
	): Promise<LocationLink[]> {
		const result = await executeDefinitionProvider(
			this.uri,
			this.translatePosition(position)
		);

		return result.map((r) => {
			r = { ...r };

			if (r.originSelectionRange) {
				r.originSelectionRange = this.translateBackRange(
					r.originSelectionRange
				);
			}
			return r;
		});
	}

	public async provideSignatureHelp(
		position: Position,
		token: CancellationToken,
		context: SignatureHelpContext
	): Promise<SignatureHelp | undefined> {
		const result = await executeSignatureHelpProvider(
			this.uri,
			this.translatePosition(position),
			context.triggerCharacter
		);

		return result;
	}

	public getDiagnostics(): Diagnostic[] {
		const diags = languages.getDiagnostics(this.uri);
		return diags.map((d) => {
			d = { ...d };
			d.range = this.translateBackRange(d.range);
			return d;
		});
	}
}
