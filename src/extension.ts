import { window, ExtensionContext } from "vscode";
import { Disposable } from "@hediet/std/disposable";
import {
	enableHotReload,
	hotRequireExportedFn,
	registerUpdateReconciler,
	getReloadCount,
} from "@hediet/node-reload";

if (process.env.HOT_RELOAD) {
	enableHotReload({ entryModule: module, loggingEnabled: true });
}

import { CustomDefinitions } from "./features/CustomDefinitions";
import { ChangeTracker } from "./features/ChangeTracker";
import { Settings } from "./Settings";
import { autorun } from "mobx";
import { DebugAdapterLogger } from "./features/DebugAdapterLogger";
import { StackFrameLineHighlighter } from "./features/StackFrameHighlighter/StackFrameHighlighter";

registerUpdateReconciler(module);

export class Extension {
	public readonly dispose = Disposable.fn();
	private readonly settings = new Settings();

	constructor() {
		if (getReloadCount(module) > 0) {
			const i = this.dispose.track(window.createStatusBarItem());
			i.text = "reload-" + getReloadCount(module);
			i.show();
		}
		this.dispose.track(
			conditional(
				() => this.settings.applyRenameEnabled.get(),
				() => new ChangeTracker()
			)
		);
		this.dispose.track(
			conditional(
				() => this.settings.customDefinitionsEnabled.get(),
				() => new CustomDefinitions()
			)
		);
		this.dispose.track(
			conditional(
				() => this.settings.debugAdapterLoggerEnabled.get(),
				() => new DebugAdapterLogger()
			)
		);

		this.dispose.track(
			conditional(
				() => this.settings.stackFrameLineHighlighterEnabled.get(),
				() => new StackFrameLineHighlighter()
			)
		);
	}
}

function conditional(check: () => boolean, factory: () => Disposable) {
	let lastVal: Disposable | undefined = undefined;
	const disposeAutorun = autorun(() => {
		if (lastVal) {
			lastVal.dispose();
			lastVal = undefined;
		}
		if (check()) {
			lastVal = factory();
		}
	});

	return {
		dispose: () => {
			disposeAutorun();
			if (lastVal) {
				lastVal.dispose();
			}
		},
	};
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		hotRequireExportedFn(module, Extension, (Extension) => new Extension())
	);
}

export function deactivate() {}
