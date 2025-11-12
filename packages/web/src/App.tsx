import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ItinerariesPage from '@/pages/ItinerariesPage';
import ItineraryDetailPage from '@/pages/ItineraryDetailPage';
import CreateItineraryPage from '@/pages/CreateItineraryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="itineraries"
          element={
            <ProtectedRoute>
              <ItinerariesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="itineraries/new"
          element={
            <ProtectedRoute>
              <CreateItineraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="itineraries/:id"
          element={
            <ProtectedRoute>
              <ItineraryDetailPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
