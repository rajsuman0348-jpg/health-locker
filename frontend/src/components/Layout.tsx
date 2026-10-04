import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  FolderLock,
  Pill,
  Stethoscope,
  Users,
  Siren,
  History,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ReactNode } from "react";

const patientNav = [
  { to: "/", label: "Dashboard", icon: LayoutGrid, end: true },
  { to: "/medical-locker", label: "Medical Locker", icon: FolderLock },
  { to: "/medications", label: "Medications", icon: Pill },
  { to: "/care-team", label: "Care Team & Appointments", icon: Stethoscope },
  { to: "/family", label: "Family & Access", icon: Users },
  { to: "/emergency", label: "Emergency", icon: Siren },
  { to: "/access-history", label: "Access History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

const doctorNav = [{ to: "/", label: "Patients", icon: LayoutGrid, end: true }];
const guardianNav = [{ to: "/", label: "Connected Patients", icon: LayoutGrid, end: true }];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = user?.role === "doctor" ? doctorNav : user?.role === "guardian" ? guardianNav : patientNav;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-line bg-panel">
        <div className="flex items-center gap-2 px-5 py-5">
          <FolderLock size={22} className="text-locker-500" strokeWidth={2.25} />
          <span className="font-serif text-lg font-semibold text-ink">Health Locker</span>
        </div>
        <nav className="px-2 pb-4 md:pb-0">
          <ul className="flex md:flex-col overflow-x-auto md:overflow-visible gap-1">
            {nav.map((item) => (
              <li key={item.to} className="shrink-0">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive ? "bg-locker-500 text-white" : "text-inkmuted hover:bg-locker-50 hover:text-ink"
                    }`
                  }
                >
                  <item.icon size={17} strokeWidth={2} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden md:block mt-auto px-5 py-4 border-t border-line">
          <div className="flex items-center gap-2 text-xs text-inkmuted mb-3">
            <ShieldCheck size={15} className="text-locker-500" />
            Your records, your control
          </div>
          <div className="text-sm font-medium text-ink">{user?.fullName}</div>
          <div className="text-xs text-inkmuted capitalize mb-3">{user?.role}</div>
          <button onClick={handleLogout} className="btn-ghost w-full justify-start px-0 text-sm">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-5 py-3 border-b border-line bg-panel">
          <div className="text-sm">
            <div className="font-medium text-ink">{user?.fullName}</div>
            <div className="text-xs text-inkmuted capitalize">{user?.role}</div>
          </div>
          <button onClick={handleLogout} className="btn-ghost text-sm px-2">
            <LogOut size={15} /> Sign out
          </button>
        </header>
        <main className="px-5 py-6 md:px-10 md:py-8 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
