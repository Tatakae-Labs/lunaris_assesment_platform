import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams
} from "react-router-dom";
import PublicWebsite from "./public/PublicWebsite";
import PlatformAdminPortal from "./platform/PlatformAdminPortal";
import CandidateEntryPortal from "./candidate/CandidateEntryPortal";
import OrgDashboard from "./organization/OrgDashboard";
import QuickQuizPortal from "./candidate/QuickQuizPortal";
import LiveProctorDashboard from "./proctor-console/LiveProctorDashboard";

function AppRoutes() {
  const navigate = useNavigate();

  // User & Organization Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("lunaris_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentOrg, setCurrentOrg] = useState(() => {
    try {
      const saved = localStorage.getItem("lunaris_user");
      if (saved) {
        const u = JSON.parse(saved);
        return {
          id: u.organization_id,
          slug: u.organization_slug,
          name: u.organization_name,
          plan_id: u.plan_id
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  // Enforce consistent pure white theme
  useEffect(() => {
    document.body.setAttribute("data-theme", "light");
    document.documentElement.style.backgroundColor = "#ffffff";
  }, []);

  function handleLoginSuccess(userData) {
    setCurrentUser(userData);
    setCurrentOrg({
      id: userData.organization_id,
      slug: userData.organization_slug,
      name: userData.organization_name,
      plan_id: userData.plan_id
    });
    if (userData.is_superadmin) {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  }

  function handleLogout() {
    localStorage.removeItem("lunaris_token");
    localStorage.removeItem("lunaris_user");
    setCurrentUser(null);
    setCurrentOrg(null);
    navigate("/");
  }

  return (
    <Routes>
      {/* 1. Public Website Pages at Dedicated Routes */}
      <Route
        path="/"
        element={
          <PublicWebsite
            initialTab="home"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/features"
        element={
          <PublicWebsite
            initialTab="features"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/pricing"
        element={
          <PublicWebsite
            initialTab="pricing"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/login"
        element={
          <PublicWebsite
            initialTab="login"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/register"
        element={
          <PublicWebsite
            initialTab="signup"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route
        path="/signup"
        element={
          <PublicWebsite
            initialTab="signup"
            currentUser={currentUser}
            currentOrg={currentOrg}
            onLogout={handleLogout}
            onLoginSuccess={handleLoginSuccess}
          />
        }
      />
      <Route path="/join" element={<Navigate to="/" replace />} />
      <Route path="/security" element={<Navigate to="/" replace />} />

      {/* 2. Creator / Organization Dashboard Route (Requires Authenticated Login) */}
      <Route
        path="/dashboard"
        element={
          !currentUser ? (
            <Navigate to="/login" replace />
          ) : currentUser?.is_superadmin ? (
            <Navigate to="/admin" replace />
          ) : (
            <OrgDashboard
              currentUser={currentUser}
              currentOrg={currentOrg}
              onLogout={handleLogout}
              onExitToPublic={() => navigate("/")}
              onOpenProctorConsole={() => navigate("/proctor")}
              onTakeExam={(slug, uid, pin) => navigate(`/exam/${slug}?uid=${uid}&pin=${pin}`)}
              onTakeQuickQuiz={(roomCode) => navigate(`/quiz/${roomCode}`)}
            />
          )
        }
      />

      {/* 3. Candidate Exam Portal Routes */}
      <Route
        path="/candidate"
        element={
          <CandidateEntryPortal
            onExit={() => navigate(currentUser ? "/dashboard" : "/")}
          />
        }
      />
      <Route
        path="/exam/:slug"
        element={
          <CandidateEntryPortal
            onExit={() => navigate(currentUser ? "/dashboard" : "/")}
          />
        }
      />

      {/* 4. Live Proctor Monitoring Console Route (Requires Login) */}
      <Route
        path="/proctor"
        element={
          !currentUser ? (
            <Navigate to="/login" replace />
          ) : (
            <ProctorConsoleWrapper
              currentOrg={currentOrg}
              onBack={() => navigate(currentUser?.is_superadmin ? "/admin" : "/dashboard")}
            />
          )
        }
      />

      {/* 5. Platform SuperAdmin Portal Route (Strictly Requires Admin Login) */}
      <Route
        path="/admin"
        element={
          !currentUser ? (
            <Navigate to="/login" replace />
          ) : !currentUser?.is_superadmin ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <PlatformAdminPortal
              currentUser={currentUser}
              onLogout={handleLogout}
              onExit={() => navigate("/")}
            />
          )
        }
      />

      {/* 6. Quick Quiz Real-time Arena Routes */}
      <Route
        path="/quiz"
        element={
          <QuickQuizWrapper
            onBack={() => navigate("/dashboard")}
          />
        }
      />
      <Route
        path="/quiz/:roomCode"
        element={
          <QuickQuizWrapper
            onBack={() => navigate("/dashboard")}
          />
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProctorConsoleWrapper({ currentOrg, onBack }) {
  return (
    <div>
      <div style={{
        background: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
      }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}
          style={{ fontSize: "13px" }}
        >
          ← Back to Creator Dashboard
        </button>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
          Live Candidate Proctoring Console · {currentOrg?.name || "Organization"}
        </span>
      </div>
      <LiveProctorDashboard
        organizationId={currentOrg?.id || currentOrg?.slug || ""}
      />
    </div>
  );
}

function QuickQuizWrapper({ onBack }) {
  const { roomCode } = useParams();
  return (
    <div>
      <div style={{
        background: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={onBack}
          style={{ fontSize: "13px" }}
        >
          ← Back to Creator Dashboard
        </button>
        <span style={{ fontSize: "12px", color: "var(--accent-amber)", fontWeight: "700" }}>
          ⚡ Quick Quiz Live Arena
        </span>
      </div>
      <QuickQuizPortal
        defaultRoomCode={roomCode || ""}
        onExit={onBack}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
