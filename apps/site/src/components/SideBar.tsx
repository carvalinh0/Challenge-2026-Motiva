import { NavLink } from "react-router-dom";
import type { Dispatch, SetStateAction } from "react";
import {
  ChartNoAxesCombined,
  LayoutDashboard,
  LogOut,
  Moon,
  RadioTower,
  Route,
  Sun,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROUTES } from "@/config/constants";
import { useAuth } from "@/features/auth";
import motivaLogo from "@/assets/motiva_logo_no_back.png";

interface SideBarProps {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  darkMode: boolean;
  setDarkMode: Dispatch<SetStateAction<boolean>>;
}

interface NavItem {
  name: string;
  path: string;
  icon: LucideIcon;
  /** `end` evita o Dashboard ficar ativo em todas as rotas filhas. */
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    path: ROUTES.dashboard,
    icon: LayoutDashboard,
    end: true,
  },
  { name: "Sensores", path: ROUTES.sensors, icon: RadioTower },
  { name: "Gráficos", path: ROUTES.charts, icon: ChartNoAxesCombined },
  { name: "Roteiro", path: ROUTES.route, icon: Route },
];

export function SideBar({
  sidebarOpen,
  setSidebarOpen,
  darkMode,
  setDarkMode,
}: SideBarProps) {
  const { username, logout } = useAuth();

  return (
    <div
      className={`fixed z-9999 flex h-screen w-64 flex-col bg-white shadow duration-200 lg:fixed lg:translate-x-0 dark:bg-gray-900 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-64"
      }`}
    >
      <div className="flex justify-between p-4">
        <img src={motivaLogo} alt="Motiva" className="h-auto w-15" />
        <button
          className="lg:hidden dark:text-gray-100"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
      </div>

      <nav className="space-y-2 p-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              to={item.path}
              key={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex space-x-2 rounded-2xl p-2 dark:text-gray-100 ${
                  isActive
                    ? "bg-purple-100 font-medium text-purple-800 dark:bg-gray-700 dark:text-white"
                    : "hover:bg-gray-100 hover:font-medium hover:text-purple-800 dark:hover:bg-gray-600 dark:hover:text-white"
                }`
              }
            >
              <Icon size={25} />
              <span className="text-xl">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="justify-left flex p-4 text-2xl">
        {darkMode ? (
          <button
            className="cursor-pointer rounded-full bg-gray-600 p-2"
            onClick={() => setDarkMode(false)}
            aria-label="Ativar modo claro"
          >
            <Sun className="text-white" />
          </button>
        ) : (
          <button
            className="cursor-pointer rounded-full bg-gray-300 p-2"
            onClick={() => setDarkMode(true)}
            aria-label="Ativar modo escuro"
          >
            <Moon className="text-black" />
          </button>
        )}
      </div>

      {/* Sessão encostada no rodapé — era o que a página de Perfil fazia. */}
      <div className="mt-auto border-t border-gray-200 p-4 dark:border-gray-700">
        {username && (
          <p className="mb-2 truncate text-sm text-gray-500 dark:text-gray-400">
            Conectado como <span className="font-medium">{username}</span>
          </p>
        )}
        <button
          onClick={logout}
          className="flex w-full cursor-pointer items-center gap-2 rounded-2xl p-2 text-gray-700 hover:bg-gray-100 hover:text-purple-800 dark:text-gray-100 dark:hover:bg-gray-600 dark:hover:text-white"
        >
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
}
