// utils/InputHandler.ts
type Action = 'left' | 'right' | 'jump' | 'duck';

const KeyMap: Record<string, Action> = {
	a: 'left',
	d: 'right',
	w: 'jump',
	s: 'duck',
};

export class InputHandler {
	private actions = new Set<Action>();

	constructor() {
		window.addEventListener('keydown', this.keydown);
		window.addEventListener('keyup', this.keyup);
	}

	private keydown = (e: KeyboardEvent) => {
		const action = KeyMap[e.key.toLowerCase()];
		if (action) this.actions.add(action);
	};

	private keyup = (e: KeyboardEvent) => {
		const action = KeyMap[e.key.toLowerCase()];
		if (action) this.actions.delete(action);
	};

	public isActionPressed(action: Action): boolean {
		return this.actions.has(action);
	}

	public getActiveActions(): Set<Action> {
		return this.actions;
	}

	public dispose() {
		window.removeEventListener('keydown', this.keydown);
		window.removeEventListener('keyup', this.keyup);
	}
}
