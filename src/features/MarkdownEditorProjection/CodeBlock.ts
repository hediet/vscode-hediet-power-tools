import { Code } from "remark";
import { Range, Position, TextDocument } from "vscode";

export class CodeBlock {
	public static from(idx: number, block: Code, doc: TextDocument) {
		const { start, end } = block.position;

		let meta: { ext?: string } | undefined;

		if (block.meta) {
			try {
				meta = JSON.parse(block.meta);
			} catch (e) {}
		}

		return new CodeBlock(
			`${idx}`,
			block.value,
			new Range(
				new Position(start.line - 1, start.column - 1),
				new Position(end.line - 1, end.column - 1)
			),
			new Range(
				new Position(start.line, start.column - 1),
				doc.lineAt(end.line - 2).range.end
			),
			block.lang,
			(meta || {}).ext
		);
	}

	constructor(
		public readonly id: string,
		public readonly content: string,
		public readonly range: Range,
		public readonly contentRange: Range,
		public readonly language: string,
		public readonly extension: string | undefined
	) {}
}
