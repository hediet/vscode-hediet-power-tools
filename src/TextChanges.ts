export class Offset {
	constructor(public readonly offset: number) {}
}

export class Position {
	constructor(public readonly line: number, public readonly column: number) {}
}

export class Range {}

export class Change {
	constructor(
		public readonly range: Range,
		public readonly newText: string
	) {}
}

export class Edit {
	constructor(public readonly changes: ReadonlyArray<Change>) {}
}

export function applyEdit(src: string, edit: Edit): string {}

interface Buffer {
	length: number;
	applyChange(change: Change): void;
}

class TextBuffer implements Buffer {
	public _text: string;

	constructor(text: string) {
		this._text = text;
	}

	public get text(): string {
		return this._text;
	}

	public get length(): number {
		return this._text.length;
	}

	public applyChange(change: Change): void {
		this._text = applyEdit(this._text, new Edit([change]));
	}
}

class Projection {
	private _range: Range;
	private _removed: boolean;

	public get range(): Range {
		return this._range;
	}
	public get removed(): boolean {
		return this._removed;
	}

	constructor(
		range: Range,
		removed: boolean,
		public readonly extendStart: boolean,
		public readonly extendEnd: boolean,
		public readonly buffer: Buffer | null
	) {
		this._range = range;
		this._removed = removed;
	}

	public processEdit(edit: Edit): void {}
}

//    (_)
//    12[](x)3
//    (_)
// => 12x3

//    (_]
//    12[](x)3
//    (__]
// => 12x3

export function applyEditGetReverse(
	src: string,
	edit: Edit
): { result: string; reverseEdit: Edit } {}

export function combineEdits(edit1: Edit, edit2: Edit): Edit {}
