import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { SkinProvider } from "@/features/skins/SkinProvider";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <SkinProvider>
        <App />
      </SkinProvider>
    </AuthProvider>
  </StrictMode>,
);
