import * as remarkAbstract from "remark";
import { Root } from "remark";

export function parseMarkdown(markdown: string): Root {
	const remark = remarkAbstract();
	const ast: Root = remark.parse(markdown);
	return ast;
}
