import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useLayoutContext } from "@/routes/layoutContext";

interface PageHeaderProps {
  title: string;
  /** Ações da página (atualizar, acionar mesh, alternar visão...). */
  children?: ReactNode;
}

/** Header comum a todas as páginas: título, botão do menu no mobile e ações. */
export function PageHeader({ title, children }: PageHeaderProps) {
  const { setSidebarOpen } = useLayoutContext();

  return (
    <header className="flex flex-col items-start gap-3 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 dark:bg-gray-700">
      <div className="flex items-center gap-3">
        <button
          className="cursor-pointer text-2xl font-bold lg:hidden dark:text-white"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="text-2xl font-bold" />
        </button>
        <h1 className="text-2xl font-bold dark:text-white">{title}</h1>
      </div>

      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {children}
        </div>
      )}
    </header>
  );
}
