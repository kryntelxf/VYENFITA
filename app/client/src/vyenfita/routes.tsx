/**
 * VYENFITA Routes
 * 
 * Mounted at /vyenfita/* in the main Appsmith router.
 * All routes below are RELATIVE to /vyenfita.
 * 
 * @version 1.0.0
 */

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ApplicationsPage from './pages/ApplicationsPage';
import NewApplicationPage from './pages/NewApplicationPage';
import WorkflowsPage from './pages/WorkflowsPage';
import SettingsPage from './pages/SettingsPage';

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#f5f6fa',
        color: '#666',
        fontSize: '14px',
      }}
    >
      Loading VYENFITA...
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/vyenfita/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  if (isAuthenticated) {
    return <Navigate to="/vyenfita/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function VYENFITARoutes() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route
          path="login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected routes */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="applications"
          element={
            <ProtectedRoute>
              <ApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="applications/new"
          element={
            <ProtectedRoute>
              <NewApplicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="applications/:id"
          element={
            <ProtectedRoute>
              <ApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="workflows"
          element={
            <ProtectedRoute>
              <WorkflowsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="workflows/:id"
          element={
            <ProtectedRoute>
              <WorkflowsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings/team"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Redirects */}
        <Route path="" element={<Navigate to="dashboard" replace />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
        }
