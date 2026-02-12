import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ShareAllocation from "./pages/ShareAllocation";
import SupplierConfirm from "./pages/SupplierConfirm";
import ConfirmationMonitor from "./pages/ConfirmationMonitor";
import Settings from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/register"} component={Register} />
      <Route path={"/"} component={Home} />
      <Route path={"/share-allocation"} component={ShareAllocation} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/confirm/:token"} component={SupplierConfirm} />
      <Route path={"/monitor"} component={ConfirmationMonitor} />
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
