import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ShareAllocation from "./pages/ShareAllocation";
import SupplierConfirm from "./pages/SupplierConfirm";
import ConfirmationMonitor from "./pages/ConfirmationMonitor";
import Settings from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import UploadPlan from "./pages/UploadPlan";
import Suppliers from "./pages/Suppliers";
import Emails from "./pages/Emails";
import ERPImport from "./pages/ERPImport";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

// 受保护的路由组件
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/confirm/:token"} component={SupplierConfirm} />
      <Route path={"/"}>
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path={"/upload"}>
        <ProtectedRoute component={UploadPlan} />
      </Route>
      <Route path={"/suppliers"}>
        <ProtectedRoute component={Suppliers} />
      </Route>
      <Route path={"/share-allocation"}>
        <ProtectedRoute component={ShareAllocation} />
      </Route>
      <Route path={"/emails"}>
        <ProtectedRoute component={Emails} />
      </Route>
      <Route path={"/settings"}>
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path={"/monitor"}>
        <ProtectedRoute component={ConfirmationMonitor} />
      </Route>
      <Route path={"/erp-import"}>
        <ProtectedRoute component={ERPImport} />
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
