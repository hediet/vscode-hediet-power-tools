import { Disposable } from "@hediet/std/disposable";
import { debug, window } from "vscode";

export class DebugAdapterLogger {
	public readonly dispose = Disposable.fn();

	private readonly channel = this.dispose.track(
		window.createOutputChannel("Debug Adapter Protocol")
	);

	constructor() {
		this.dispose.track(
			debug.registerDebugAdapterTrackerFactory("*", {
				createDebugAdapterTracker: (session) => ({
					onWillStartSession: () => {
						this.channel.appendLine(`Session will start.`);
					},
					onWillStopSession: () => {
						this.channel.appendLine(`Session will stop.`);
					},

					onWillReceiveMessage: (message) => {
						this.channel.appendLine(
							`<- ${JSON.stringify(message)}`
						);
					},
					onDidSendMessage: (message) => {
						this.channel.appendLine(
							`-> ${JSON.stringify(message)}`
						);
					},

					onError: (error) => {
						this.channel.appendLine(`Error: ${error}`);
					},

					onExit: (code, signal) => {
						this.channel.appendLine(
							`Session exited. Code: ${code}. Signal: ${signal}.`
						);
					},
				}),
			})
		);
	}
}
