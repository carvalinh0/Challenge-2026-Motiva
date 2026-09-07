import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SideBar } from "@/components/SideBar";
import { THEME_STORAGE_KEY } from "@/config/constants";
import type { LayoutContext } from "./layoutContext";

/** Casca das telas autenticadas: sidebar + área de conteúdo. */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem(THEME_STORAGE_KEY) === "dark",
  );

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, darkMode ? "dark" : "light");
  }, [darkMode]);

  const context: LayoutContext = {
    sidebarOpen,
    setSidebarOpen,
    darkMode,
    setDarkMode,
  };

  return (
    <div
      className={`flex min-h-screen bg-slate-200 dark:bg-gray-800 ${darkMode ? "dark" : ""}`}
    >
      <SideBar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      <div className="flex-1 lg:ml-64 min-w-0">
        <Outlet context={context} />
      </div>
    </div>
  );
}
