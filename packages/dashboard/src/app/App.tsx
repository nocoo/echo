import { lazy, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { resolvePageContext } from "../lib/navigation";
import { AppFrame } from "./AppFrame";
import { BasaltProviders } from "./BasaltProviders";
import LoginPage from "./login/LoginPage";

const OverviewPage = lazy(() => import("./overview/OverviewPage"));
const LookupPage = lazy(() => import("./lookup/LookupPage"));
const ToolsPage = lazy(() => import("./tools/ToolsPage"));
const KeysPage = lazy(() => import("./keys/KeysPage"));

function DocumentTitle() {
  const { pathname } = useLocation();
  const { documentTitle } = resolvePageContext(pathname);

  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  return null;
}

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <BasaltProviders>
        <DocumentTitle />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppFrame />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/lookup" element={<LookupPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/keys" element={<KeysPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BasaltProviders>
    </BrowserRouter>
  );
}
