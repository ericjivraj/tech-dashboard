import { useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import BusinessView from "@/pages/business";
import Layout from "@/components/layout";
import AdminLoginForm from "@/components/admin-login-form";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function CookieAdminPage() {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) return null;
  if (!me?.isEditor) {
    return <AdminLoginForm />;
  }
  return <Dashboard />;
}

function AppShell() {
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  const handleSignOut = useCallback(async () => {
    try {
      await fetch(`${basePath}/api/admin/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      await queryClient.invalidateQueries();
    }
  }, [queryClient]);

  const onSignOut = me?.isEditor ? handleSignOut : undefined;

  return (
    <Layout onSignOut={onSignOut}>
      <Switch>
        <Route path="/business" component={BusinessView} />
        <Route path="/leadership" component={Dashboard} />
        <Route path="/admin" component={CookieAdminPage} />
        <Route path="/" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
