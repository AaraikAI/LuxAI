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
import PrivateAviationPage from '@/pages/PrivateAviationPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import KYCVerificationPage from '@/pages/KYCVerificationPage';
import { VendorOnboardingPage } from '@/pages/VendorOnboardingPage';
import { VendorDashboardPage } from '@/pages/VendorDashboardPage';
import { SustainabilityReportPage } from '@/pages/SustainabilityReportPage';
import { PaymentPage } from '@/pages/PaymentPage';
import { LiveUpdatesManagementPage } from '@/pages/LiveUpdatesManagementPage';
import { DocuSignPage } from '@/pages/DocuSignPage';
import { VaultMarketplacePage } from '@/pages/VaultMarketplacePage';
import { VaultDealDetailPage } from '@/pages/VaultDealDetailPage';
import { FlightSearchPage } from '@/pages/FlightSearchPage';
import { ForumPage } from '@/pages/ForumPage';
import { ForumPostPage } from '@/pages/ForumPostPage';
import { AnalyticsDashboardPage } from '@/pages/AnalyticsDashboardPage';
import { ReportsPage } from '@/pages/ReportsPage';

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
        <Route
          path="aviation"
          element={
            <ProtectedRoute>
              <PrivateAviationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute>
              <ApprovalsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="kyc"
          element={
            <ProtectedRoute>
              <KYCVerificationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="vendor/onboard"
          element={
            <ProtectedRoute>
              <VendorOnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="vendor/dashboard"
          element={
            <ProtectedRoute>
              <VendorDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="sustainability/:itineraryId"
          element={
            <ProtectedRoute>
              <SustainabilityReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment"
          element={
            <ProtectedRoute>
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="live-updates/:itineraryId"
          element={
            <ProtectedRoute>
              <LiveUpdatesManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="docusign"
          element={
            <ProtectedRoute>
              <DocuSignPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="vault"
          element={
            <ProtectedRoute>
              <VaultMarketplacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="vault/deals/:id"
          element={
            <ProtectedRoute>
              <VaultDealDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="flights"
          element={
            <ProtectedRoute>
              <FlightSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="forum"
          element={
            <ProtectedRoute>
              <ForumPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="forum/posts/:id"
          element={
            <ProtectedRoute>
              <ForumPostPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="analytics"
          element={
            <ProtectedRoute>
              <AnalyticsDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default App;
