declare module "remark" {
	module fn {
		export interface Position {
			line: number;
			column: number;
			offset: number;
		}

		export interface Range {
			start: Position;
			end: Position;
		}

		export interface Node<T extends string = string> {
			position: Range;
			type: T;
		}

		export interface NodeList<
			T extends string = string,
			TItem extends Node = Node
		> extends Node<T> {
			children: TItem[];
		}

		export interface Root extends NodeList<"root", Item> {}

		type Item =
			| Yaml
			| Toml
			| Heading
			| Emphasis
			| Paragraph
			| Strong
			| Text
			| InlineCode
			| ThematicBreak
			| Code
			| List
			| Link
			| Image;

		export interface Yaml extends Node<"yaml"> {
			value: string;
		}
		export interface Toml extends Node<"toml"> {
			value: string;
		}

		export interface Paragraph extends NodeList<"paragraph", Item> {}
		export interface Emphasis extends NodeList<"emphasis", Item> {}
		export interface Paragraph extends NodeList<"paragraph", Item> {}
		export interface Strong extends NodeList<"strong", Item> {}
		export interface List extends NodeList<"list", ListItem> {
			lang: string;
			value: string;
			ordered: boolean;
			spreak: boolean;
		}
		export interface ListItem extends NodeList<"listItem", Item> {
			spread: boolean;
			checked: null;
		}

		export interface Text extends Node<"text"> {
			value: string;
		}
		export interface InlineCode extends Node<"inlineCode"> {
			value: string;
		}
		export interface ThematicBreak extends Node<"thematicBreak"> {}
		export interface Code extends Node<"code"> {
			lang: string;
			value: string;
			meta: null | string;
		}
		export interface Link extends NodeList<"link", Item> {
			title: null | string;
			url: string;
		}

		export interface Image extends Node<"image"> {
			title: null | string;
			url: string;
			alt: string;
		}

		export interface Heading extends NodeList<"heading", Item> {
			depth: number;
		}
	}

	const fn: Function;
	export = fn;
}

declare module "remark-frontmatter" {
	const x: any;
	export = x;
}
