import AuthGate from "@/components/dashboard/AuthGate";
import Dashboard from "@/components/dashboard/Dashboard";
import { ToastProvider } from "@/components/dashboard/notifications";

export default function Home() {
  return (
    <AuthGate>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </AuthGate>
  );
}