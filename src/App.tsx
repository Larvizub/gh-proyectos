import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UsersProvider } from './contexts/UsersContext';
import ErrorBoundary from './components/ErrorBoundary';
import { MainLayout } from './components/layout/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import ExternosPage from './pages/admin/ExternosPage';
import UserProfilePage from './pages/UserProfilePage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectDetailsPage from './pages/ProjectDetailsPage';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return firebaseUser ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <UsersProvider>
          <ErrorBoundary>
          {/* Global toaster for sonner to show toast notifications */}
          <Toaster position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailsPage />} />
              <Route path="/projects/new" element={<NewProjectPage />} />
              <Route path="/profile" element={<UserProfilePage />} />
              <Route path="/admin" element={<Navigate to="/admin/users" />} />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/roles" element={<RolesPage />} />
              <Route path="/admin/externos" element={<ExternosPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </BrowserRouter>
        </ErrorBoundary>
        </UsersProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
