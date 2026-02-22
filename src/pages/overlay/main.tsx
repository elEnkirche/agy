import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../../index.css";
import { AgyOverlay } from "./index.tsx";

document.documentElement.classList.add("dark");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AgyOverlay />
  </StrictMode>,
);
