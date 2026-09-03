import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/features/auth";
import { router } from "@/routes";
import "./index.css";

const container = document.getElementById("root");
if (!container) throw new Error('Elemento #root não encontrado no index.html');

createRoot(container).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
