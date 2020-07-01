import { Disposable } from "@hediet/std/disposable";
import { languages, workspace, Range, DefinitionLink } from "vscode";

export class CustomDefinitions {
	public readonly dispose = Disposable.fn();

	constructor() {
		this.dispose.track(
			languages.registerDefinitionProvider(
				{ pattern: "**/*" },
				{
					provideDefinition: (doc, position, token) => {
						const range = doc.getWordRangeAtPosition(position);
						const identifier = doc.getText(range);

						const result = new Array<DefinitionLink>();
						for (const openedDoc of workspace.textDocuments) {
							const text = openedDoc.getText();
							console.log(text);

							const regexp = new RegExp(
								`(def\\W+)` + identifier,
								"g"
							);
							do {
								var m = regexp.exec(text);
								if (m) {
									const start = m.index! + m[1].length;
									const end = m.index! + m[0].length;
									result.push({
										targetUri: openedDoc.uri,
										targetRange: new Range(
											openedDoc.positionAt(start),
											openedDoc.positionAt(end)
										),
									});
								}
							} while (m);
						}

						return result;
					},
				}
			)
		);
	}
}
