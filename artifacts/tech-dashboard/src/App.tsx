import { useCallback, useEffect, useRef } from "react";
import { ClerkProvider, SignIn, useAuth, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import BusinessView from "@/pages/business";
import Layout from "@/components/layout";
import PasscodeGate from "@/components/passcode-gate";
import AdminLoginForm from "@/components/admin-login-form";

const queryClient = new QueryClient();

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// clerkPubKey may be absent in environments where auth is not configured.
// In that case the app renders in read-only mode with no editor controls.

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(222.2, 47.4%, 11.2%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInputBackground: "hsl(0, 0%, 100%)",
    colorText: "hsl(222.2, 84%, 4.9%)",
    colorTextSecondary: "hsl(215.4, 16.3%, 46.9%)",
    colorInputText: "hsl(222.2, 84%, 4.9%)",
    colorNeutral: "hsl(215.4, 16.3%, 46.9%)",
    borderRadius: "0.5rem",
    fontFamily: "Inter, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "border border-border shadow-md rounded-lg w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none border-t border-border",
    headerTitle: { color: "hsl(222.2, 84%, 4.9%)" },
    headerSubtitle: { color: "hsl(215.4, 16.3%, 46.9%)" },
    socialButtonsBlockButtonText: { color: "hsl(222.2, 84%, 4.9%)" },
    formFieldLabel: { color: "hsl(222.2, 84%, 4.9%)" },
    footerActionLink: { color: "hsl(222.2, 47.4%, 11.2%)" },
    footerActionText: { color: "hsl(215.4, 16.3%, 46.9%)" },
    dividerText: { color: "hsl(215.4, 16.3%, 46.9%)" },
    identityPreviewEditButton: { color: "hsl(222.2, 47.4%, 11.2%)" },
    formFieldSuccessText: { color: "hsl(222.2, 84%, 4.9%)" },
    alertText: { color: "hsl(0, 84.2%, 60.2%)" },
  },
};

const signInAppearance = {
  ...clerkAppearance,
  elements: {
    ...clerkAppearance.elements,
    footerAction__signIn: { display: "none" },
    footerAction__signUp: { display: "none" },
  },
};

function AdminPage() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
        <SignIn
          routing="path"
          path={`${basePath}/admin`}
          signUpUrl={`${basePath}/sign-up`}
          forceRedirectUrl={`${basePath}/admin`}
          appearance={signInAppearance}
        />
      </div>
    );
  }
  return <Dashboard />;
}

function SignUpPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/admin");
  }, [setLocation]);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <div className="rounded-xl border bg-card shadow-md p-8 max-w-sm w-full text-center space-y-4">
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground">
          Editor accounts are managed by your administrator. If you need access, contact your system administrator to have your account provisioned.
        </p>
        <button
          className="text-sm font-medium underline underline-offset-2"
          onClick={() => setLocation("/admin")}
        >
          Back to Sign In
        </button>
      </div>
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkRoutes() {
  const { signOut } = useClerk();
  const handleSignOut = useCallback(() => signOut(), [signOut]);
  return (
    <Layout onSignOut={handleSignOut}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/business" component={BusinessView} />
        <Route path="/admin/*?" component={AdminPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <ClerkRoutes />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function CookieAdminPage() {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) return null;
  if (!me?.isEditor) {
    return <AdminLoginForm />;
  }
  return <Dashboard />;
}

function ReadOnlyAppShell() {
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
        <Route path="/" component={Dashboard} />
        <Route path="/business" component={BusinessView} />
        <Route path="/admin" component={CookieAdminPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ReadOnlyApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReadOnlyAppShell />
    </QueryClientProvider>
  );
}

function GatedRoutes() {
  const [location] = useLocation();
  const isAdminPath = location === "/admin" || location.startsWith("/admin/");
  return (
    <PasscodeGate bypass={isAdminPath}>
      {clerkPubKey ? <ClerkProviderWithRoutes /> : <ReadOnlyApp />}
    </PasscodeGate>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <GatedRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
