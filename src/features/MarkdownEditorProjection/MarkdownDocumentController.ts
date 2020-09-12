import { Disposable } from "@hediet/std/disposable";
import { action, observable } from "mobx";
import { Code, Item, Root } from "remark";
import {
	languages,
	workspace,
	Uri,
	Position,
	TextDocument,
	CancellationToken,
	CompletionContext,
	CompletionList,
	SignatureHelpContext,
	SignatureHelp,
	Diagnostic,
	LocationLink,
	ConfigurationTarget,
} from "vscode";
import { parseMarkdown } from "../utils/parseMarkdown";
import { ProjectionTarget } from "./ProjectionTarget";
import { CodeBlock } from "./CodeBlock";
import { exec, spawnSync } from "child_process";
import { promisify } from "util";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export class MarkdownDocumentController {
	public readonly dispose = Disposable.fn();
	private readonly diagnostics = this.dispose.track(
		languages.createDiagnosticCollection()
	);

	@observable.ref public blocks: ReadonlyArray<CodeBlock> = [];

	private targets = new Map<string, ProjectionTarget>();

	constructor(private readonly doc: TextDocument) {
		this.setVsCodeExcludeConfig();
		this.setGitignoreExcludeConfig();

		this.dispose.track(
			workspace.onDidChangeTextDocument(
				({ contentChanges, document }) => {
					if (document !== this.doc) {
						return;
					}
					this.processContent();
				}
			)
		);

		this.processContent();

		this.dispose.track(
			languages.onDidChangeDiagnostics(({ uris }) => {
				if (
					uris.length === 1 &&
					uris[0].toString() === this.doc.uri.toString()
				) {
					return;
				}
				this.updateDiagnostics();
			})
		);
		this.updateDiagnostics();
	}

	private async setGitignoreExcludeConfig() {
		const { stdout } = await promisify(exec)(
			"git config --get core.excludesfile"
		);
		let file: string;
		if (existsSync(stdout)) {
			file = stdout;
		} else {
			file = join(homedir(), ".git-global-excludes-file");
			writeFileSync(file, "", { encoding: "utf-8" });
			spawnSync("git", ["config", "--global", "core.excludesFile", file]);
		}

		const lines = readFileSync(file, { encoding: "utf-8" }).split("\n");
		if (!lines.some((l) => l.trim() === ".tmp-projections/")) {
			lines.push(".tmp-projections/");
			writeFileSync(file, lines.join("\n"), {
				encoding: "utf-8",
			});
		}
	}

	private setVsCodeExcludeConfig() {
		const existing: Record<string, boolean> =
			workspace.getConfiguration().get("files.exclude") || {};
		existing[".tmp-projections/"] = true;
		workspace
			.getConfiguration()
			.update("files.exclude", existing, ConfigurationTarget.Global);
	}

	private updateDiagnostics() {
		const d = new Array<Diagnostic>();
		for (const t of this.targets.values()) {
			d.push(...t.getDiagnostics());
		}
		this.diagnostics.set(this.doc.uri, d);
	}

	@action
	private processContent(): void {
		const blocks = this.getCodeBlocks();
		this.blocks = blocks;

		const newTargets = new Map<string, ProjectionTarget>();

		for (const block of blocks) {
			let target: ProjectionTarget;
			const options = {
				id: block.id,
				language: block.language,
				extension: block.extension,
			};
			const key = JSON.stringify(options);

			if (this.targets.has(key)) {
				target = this.targets.get(key)!;
			} else {
				target = new ProjectionTarget(this.doc.uri, options);
			}
			newTargets.set(key, target);
			target.update(block);
		}

		for (const [key, val] of this.targets) {
			if (!newTargets.has(key)) {
				val.dispose();
			}
		}
		this.targets = newTargets;

		this.updateDiagnostics();
	}

	private getCodeBlocks(): CodeBlock[] {
		const content = this.doc.getText();
		const root = parseMarkdown(content);

		const codeblocks = new Array<Code>();
		collectAllCodeBlocks(root, codeblocks);

		return codeblocks.map((b, idx) => CodeBlock.from(idx, b, this.doc));
	}

	private getTarget(position: Position): ProjectionTarget | undefined {
		const target = [...this.targets.values()].find((t) =>
			t.block.contentRange.contains(position)
		);
		return target;
	}

	public async provideCompletionItems(
		position: Position,
		token: CancellationToken,
		context: CompletionContext
	): Promise<CompletionList> {
		const target = this.getTarget(position);
		if (!target) {
			return new CompletionList([], true);
		}
		return target.provideCompletionItems(position, token, context);
	}

	public async provideDefinition(
		position: Position,
		token: CancellationToken
	): Promise<LocationLink[]> {
		const target = this.getTarget(position);
		if (!target) {
			return [];
		}
		return await target.provideDefinition(position, token);
	}

	public async provideSignatureHelp(
		position: Position,
		token: CancellationToken,
		context: SignatureHelpContext
	): Promise<SignatureHelp | undefined> {
		const target = this.getTarget(position);
		if (!target) {
			return undefined;
		}
		return await target.provideSignatureHelp(position, token, context);
	}
}
function modifySegments(
	uri: Uri,
	effect: (segments: string[]) => string[] | void
) {
	const segments = uri.path.split("/");
	let result = effect(segments);
	if (!result) {
		result = segments;
	}
	return uri.with({ path: result.join("/") });
}

export function addSegmentToUri(uri: Uri, segment: string): Uri {
	return modifySegments(uri, (s) => {
		s.push(segment);
	});
}

export function getParentUri(uri: Uri): Uri {
	return modifySegments(uri, (s) => {
		s.pop();
	});
}
function collectAllCodeBlocks(item: Item | Root, codeblocks: Code[]): void {
	switch (item.type) {
		case "code":
			codeblocks.push(item);
			return;

		case "root":
			for (const c of item.children) {
				collectAllCodeBlocks(c, codeblocks);
			}
			return;
		case "list":
			for (const c of item.children) {
				for (const x of c.children) {
					collectAllCodeBlocks(x, codeblocks);
				}
			}
			return;
	}
}
