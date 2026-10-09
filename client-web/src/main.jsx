import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClientAuthProvider } from "./context/ClientAuthContext.jsx";
import App from "./App.jsx";
import "./index.css";

const client = new QueryClient({ defaultOptions:{ queries:{staleTime:30000,retry:1,refetchOnWindowFocus:false} } });
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js"));
createRoot(document.getElementById("root")).render(<StrictMode><BrowserRouter><QueryClientProvider client={client}><ClientAuthProvider><App/></ClientAuthProvider></QueryClientProvider></BrowserRouter></StrictMode>);
