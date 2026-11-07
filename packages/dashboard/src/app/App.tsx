import { LoadingScreen } from "@nocoo/basalt/components/loading-screen";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { AppFrame } from "./AppFrame";
import { BasaltProviders } from "./BasaltProviders";

const LoginPage = lazy(() => import("./login/LoginPage"));
const OverviewPage = lazy(() => import("./overview/OverviewPage"));
const LookupPage = lazy(() => import("./lookup/LookupPage"));
const ToolsPage = lazy(() => import("./tools/ToolsPage"));
const KeysPage = lazy(() => import("./keys/KeysPage"));

export function App() {
  return (
    <BrowserRouter basename="/admin">
      <BasaltProviders>
        <Suspense fallback={<LoadingScreen label="页面加载中" />}>
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
        </Suspense>
      </BasaltProviders>
    </BrowserRouter>
  );
}
