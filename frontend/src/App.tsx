import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PatientDashboard from "./pages/PatientDashboard";
import MedicalLocker from "./pages/MedicalLocker";
import Medications from "./pages/Medications";
import CareTeam from "./pages/CareTeam";
import Family from "./pages/Family";
import Emergency from "./pages/Emergency";
import AccessHistory from "./pages/AccessHistory";
import Settings from "./pages/Settings";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorPatientView from "./pages/DoctorPatientView";
import GuardianDashboard from "./pages/GuardianDashboard";
import GuardianPatientView from "./pages/GuardianPatientView";

function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "doctor") return <DoctorDashboard />;
  if (user?.role === "guardian") return <GuardianDashboard />;
  return <PatientDashboard />;
}

function PatientDetail() {
  const { user } = useAuth();
  if (user?.role === "doctor") return <DoctorPatientView />;
  if (user?.role === "guardian") return <GuardianPatientView />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/patients/:patientId" element={<ProtectedRoute><PatientDetail /></ProtectedRoute>} />
          <Route path="/medical-locker" element={<ProtectedRoute><MedicalLocker /></ProtectedRoute>} />
          <Route path="/medications" element={<ProtectedRoute><Medications /></ProtectedRoute>} />
          <Route path="/care-team" element={<ProtectedRoute><CareTeam /></ProtectedRoute>} />
          <Route path="/family" element={<ProtectedRoute><Family /></ProtectedRoute>} />
          <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
          <Route path="/access-history" element={<ProtectedRoute><AccessHistory /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
