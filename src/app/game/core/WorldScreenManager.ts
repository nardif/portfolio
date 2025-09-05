export interface WorldScreen {
	id: string;
	yStart: number;
	height: number;
	onEnter?: () => void;
}

export class WorldScreenManager {
	private screens: WorldScreen[];
	private currentScreenId: string | null = null;

	constructor(screens: WorldScreen[]) {
		this.screens = screens;
	}

	update(playerY: number) {
		const screen = this.screens.find((s) => playerY >= s.yStart && playerY < s.yStart + s.height);

		if (screen && screen.id !== this.currentScreenId) {
			this.currentScreenId = screen.id;
			if (screen.onEnter) screen.onEnter(); // activa evento al entrar
		}
	}

	getCurrentScreen(): WorldScreen | null {
		return this.screens.find((s) => s.id === this.currentScreenId) || null;
	}

	// 👉 NUEVO: para que GameManager pueda encontrar una pantalla por id
	getById(id: string): WorldScreen | undefined {
		return this.screens.find((s) => s.id === id);
	}

	// 👉 NUEVO: útil si querés listar/iterar (lo usamos en goToScreen del ejemplo)
	getScreens(): WorldScreen[] {
		return this.screens;
	}

	// (Opcional) útil para cálculos sin cambiar currentScreenId
	getScreenForY(y: number): WorldScreen | undefined {
		return this.screens.find((s) => y >= s.yStart && y < s.yStart + s.height);
	}
}
