import { Disposable } from "@hediet/std/disposable";
import { debug, DebugSession } from "vscode";
import { EventEmitter } from "@hediet/std/events";
import { observable, action, autorun, runInAction } from "mobx";

export class VsCodeDebugger {
	public readonly dispose = Disposable.fn();
	private readonly sessions = new Map<DebugSession, VsCodeDebugSession>();

	private readonly _onDidStartDebugSession = new EventEmitter<{
		session: VsCodeDebugSession;
	}>();
	public readonly onDidStartDebugSession = this._onDidStartDebugSession.asEvent();

	public getDebugSession(session: DebugSession): VsCodeDebugSession {
		let result = this.sessions.get(session);
		if (!result) {
			result = new VsCodeDebugSession(session);
			this.sessions.set(session, result);
		}
		return result;
	}

	constructor() {
		this.dispose.track([
			debug.onDidStartDebugSession((session) => {
				const e = this.sessions.get(session)!;
				this._onDidStartDebugSession.emit({ session: e });
			}),
			debug.onDidTerminateDebugSession((session) => {
				this.sessions.delete(session);
			}),
			debug.registerDebugAdapterTrackerFactory("*", {
				createDebugAdapterTracker: (session) => {
					const extendedSession = this.getDebugSession(session);
					return {
						onWillReceiveMessage: (msg) => {
							// Don't spam the console
							// console.log(msg.type, msg.event, msg);
						},
						onDidSendMessage: async (msg) => {
							type Message =
								| StoppedEvent
								| ThreadsResponse
								| ContinueLikeResponse;

							interface ContinueLikeResponse {
								type: "response";
								command:
									| "continue"
									| "stepIn"
									| "stepOut"
									| "next";
							}

							interface StoppedEvent {
								type: "event";
								event: "stopped";
								body: {
									threadId: number;
								};
							}

							interface ThreadsResponse {
								type: "response";
								command: "threads";
								success: boolean;
								body: {
									threads: ThreadInfo[];
								};
							}

							interface ThreadInfo {
								id: number;
								name: string;
							}

							const m = msg as Message;
							if (m.type === "event") {
								if (m.event === "stopped") {
									const threadId = m.body.threadId;
									const r = await extendedSession[
										"getStackTrace"
									]({
										threadId,
										startFrame: 0,
										levels: 19,
									});
									extendedSession["activeStackFrames"] =
										r.stackFrames;
								}
							} else if (m.type === "response") {
								if (
									m.command === "continue" ||
									m.command === "next" ||
									m.command === "stepIn" ||
									m.command === "stepOut"
								) {
									extendedSession[
										"activeStackFrames"
									] = undefined;
								}
							}
						},
					};
				},
			}),
		]);
	}
}

interface StackFrame {
	id: number;
	name: string;
	source: { name: string; path: string } | undefined;
	line: number;
	column: number;
}

export class VsCodeDebugSession {
	@observable protected activeStackFrames: StackFrame[] | undefined = [];

	constructor(public readonly session: DebugSession) {}

	protected async getStackTrace(args: {
		threadId: number;
		startFrame?: number;
		levels?: number;
	}): Promise<{ totalFrames?: number; stackFrames: StackFrame[] }> {
		try {
			const reply = (await this.session.customRequest("stackTrace", {
				threadId: args.threadId,
				levels: args.levels,
				startFrame: args.startFrame || 0,
			})) as { totalFrames?: number; stackFrames: StackFrame[] };
			return reply;
		} catch (e) {
			console.error(e);
			throw e;
		}
	}
}

class DebouncedObservable<T> {
	@observable
	private value: T;

	constructor(initialValue: T) {
		this.value = initialValue;
	}

	public get(): T {
		return this.value;
	}

	private timeoutHandle: any;

	public set(value: T): void {
		if (this.timeoutHandle) {
			clearTimeout(this.timeoutHandle);
		}
		this.timeoutHandle = setTimeout(() => {
			runInAction("Set value after debounce", () => {
				console.log(value);
				this.value = value;
			});
		}, 300);
	}
}

export class VsCodeDebuggerView {
	public readonly dispose = Disposable.fn();

	@observable private _activeDebugSession: VsCodeDebugSession | undefined;

	public get activeDebugSession(): VsCodeDebugSession | undefined {
		return this._activeDebugSession;
	}

	private readonly _debouncedActiveStackFrames = new DebouncedObservable<
		StackFrame[] | undefined
	>(undefined);

	public get debouncedActiveStackFrames(): StackFrame[] | undefined {
		return this._debouncedActiveStackFrames.get();
	}

	public get activeStackFrames(): StackFrame[] | undefined {
		if (!this._activeDebugSession) {
			return undefined;
		} else {
			return this._activeDebugSession["activeStackFrames"];
		}
	}

	constructor(private vsCodeDebugger: VsCodeDebugger) {
		this.dispose.track(
			debug.onDidChangeActiveDebugSession((activeSession) => {
				this.updateActiveDebugSession(activeSession);
			})
		);
		this.updateActiveDebugSession(debug.activeDebugSession);
		this.dispose.track({
			dispose: autorun(
				() => {
					this._debouncedActiveStackFrames.set(
						this.activeStackFrames
					);
				},
				{
					name: "Debounced Active Stack Update",
				}
			),
		});
	}

	@action
	private updateActiveDebugSession(activeSession: DebugSession | undefined) {
		if (!activeSession) {
			this._activeDebugSession = undefined;
		} else {
			const s = this.vsCodeDebugger.getDebugSession(activeSession);
			this._activeDebugSession = s;
		}
	}
}

export const vsCodeDebugger = new VsCodeDebugger();
export const vsCodeDebuggerView = new VsCodeDebuggerView(vsCodeDebugger);
