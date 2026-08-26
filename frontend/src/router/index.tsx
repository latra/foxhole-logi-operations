/* ── Route definitions ────────────────────────────────────────────── */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/LoginPage";
import HomePage from "../pages/HomePage";
import OperationsPage from "../pages/OperationsPage";
import LogisticsPage from "../pages/LogisticsPage";
import StockpilesPage from "../pages/StockpilesPage";
import GroupMembersPage from "../pages/GroupMembersPage";
import MapPage from "../pages/MapPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations"
          element={
            <ProtectedRoute>
              <OperationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operations/:operationId"
          element={
            <ProtectedRoute>
              <OperationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/groups/:groupId/members"
          element={
            <ProtectedRoute>
              <GroupMembersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/logistics"
          element={
            <ProtectedRoute>
              <LogisticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stockpiles"
          element={
            <ProtectedRoute>
              <StockpilesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/map"
          element={
            <ProtectedRoute>
              <MapPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
