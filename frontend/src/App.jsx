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
import { ToastContainer, toast } from "./shared/toast";
import { WebsiteInitialLoader, LoginSuccessOverlay } from "./shared/BrandTransition";

function AppRoutes() {
  const navigate = useNavigate();

  // Initial Website Loading Screen State
  const [initialLoading, setInitialLoading] = useState(true);

  // Post-Login Logo Rotation & Animation State
  const [loginTransition, setLoginTransition] = useState(null);

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

  // Handle unauthorized / expired session
  useEffect(() => {
    let notified = false;
    const handleUnauthorized = () => {
      if (notified) return;
      notified = true;
      setCurrentUser(null);
      setCurrentOrg(null);
      toast.error("Your session has expired. Please log in again.");
      navigate("/login");
      setTimeout(() => { notified = false; }, 2000);
    };
    window.addEventListener("lunaris:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("lunaris:unauthorized", handleUnauthorized);
  }, [navigate]);

  function handleLoginSuccess(userData) {
    setCurrentUser(userData);
    setCurrentOrg({
      id: userData.organization_id,
      slug: userData.organization_slug,
      name: userData.organization_name,
      plan_id: userData.plan_id
    });
    // Trigger logo rotation & celebration overlay
    setLoginTransition(userData);
  }

  function handleFinishLoginTransition() {
    const u = loginTransition;
    setLoginTransition(null);
    if (u?.is_superadmin) {
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
    <>
      {initialLoading && (
        <WebsiteInitialLoader minDuration={3000} onComplete={() => setInitialLoading(false)} />
      )}
      {loginTransition && (
        <LoginSuccessOverlay user={loginTransition} minDuration={3000} onComplete={handleFinishLoginTransition} />
      )}
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
        path="/candidate/entry"
        element={
          <CandidateEntryPortal
            onExit={() => navigate(currentUser ? "/dashboard" : "/")}
          />
        }
      />
      <Route
        path="/candidate/login"
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
    </>
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
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#f8fafc" }}>
      <div style={{
        background: "#ffffff",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "10px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0
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
          Quick Quiz Live Arena
        </span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <QuickQuizPortal
          defaultRoomCode={roomCode || ""}
          onExit={onBack}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#ffffff", color: "var(--text-primary)" }}>
        <ToastContainer />
        <AppRoutes />
      </div>
    </BrowserRouter>
  );
}
