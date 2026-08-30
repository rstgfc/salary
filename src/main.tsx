import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initKvShim } from "./core/kvshim.ts";

initKvShim().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
});
