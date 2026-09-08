import { create } from 'zustand';

/** Estado efímero de interfaz (decisión D6). Lo compartible vive en la URL. */
interface UiState {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  menuOpen: false,
  setMenuOpen: (open) => set({ menuOpen: open }),
}));
