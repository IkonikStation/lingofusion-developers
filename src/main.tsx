import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { PromotionProvider } from "./data/promotion";
import { LocalizationProvider } from "./locales/context";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocalizationProvider>
      <PromotionProvider>
        <App />
      </PromotionProvider>
    </LocalizationProvider>
  </React.StrictMode>,
);
