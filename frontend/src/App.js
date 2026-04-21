import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadForm from "./pages/LeadForm";
import LeadDetail from "./pages/LeadDetail";
import Funnel from "./pages/Funnel";
import Tasks from "./pages/Tasks";
import UsersPage from "./pages/Users";
import Masters from "./pages/Masters";
import Campaigns from "./pages/Campaigns";
import Automation from "./pages/Automation";
import Branches from "./pages/Branches";
import AuditLogs from "./pages/AuditLogs";
import Whatsapp from "./pages/Whatsapp";
import BranchDetail from "./pages/BranchDetail";
import UserDetail from "./pages/UserDetail";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster richColors position="top-right" />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/new" element={<ProtectedRoute><LeadForm /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/funnel" element={<ProtectedRoute><Funnel /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/whatsapp" element={<ProtectedRoute><Whatsapp /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={["super_admin", "admin"]}><UsersPage /></ProtectedRoute>} />
            <Route path="/branches" element={<ProtectedRoute roles={["super_admin", "admin"]}><Branches /></ProtectedRoute>} />
            <Route path="/branches/:id" element={<ProtectedRoute><BranchDetail /></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><UserDetail /></ProtectedRoute>} />
            <Route path="/audit-logs" element={<ProtectedRoute roles={["super_admin", "admin"]}><AuditLogs /></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute roles={["super_admin", "admin"]}><Campaigns /></ProtectedRoute>} />
            <Route path="/automation" element={<ProtectedRoute roles={["super_admin", "admin"]}><Automation /></ProtectedRoute>} />
            <Route path="/masters" element={<ProtectedRoute roles={["super_admin"]}><Masters /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
