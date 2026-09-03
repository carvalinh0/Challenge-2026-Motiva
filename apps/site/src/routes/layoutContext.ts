import { useOutletContext } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";

/**
 * Contexto que o Layout passa às páginas via <Outlet context>. Tipado num
 * lugar só: sem isso cada página precisaria repetir a forma do objeto, e um
 * `useOutletContext()` sem tipo devolve `unknown`.
 */
export interface LayoutContext {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
}

export function useLayoutContext(): LayoutContext {
  return useOutletContext<LayoutContext>();
}
