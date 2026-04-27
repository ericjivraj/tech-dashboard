// Runtime config — values that vary per Kubernetes environment but ship in a
// single image artifact. The api-server injects `window.__APP_CONFIG__` into
// the served index.html before the dashboard scripts run; in local development
// the script tag isn't present, so we fall back to Vite's build-time
// import.meta.env.VITE_* values.

declare global {
  interface Window {
    __APP_CONFIG__?: {
      clerkPublishableKey?: string;
      clerkProxyUrl?: string;
      sitePasscode?: string;
      resendConfigured?: boolean;
    };
  }
}

const injected = typeof window !== "undefined" ? window.__APP_CONFIG__ : undefined;

export const runtimeConfig = {
  clerkPublishableKey:
    injected?.clerkPublishableKey ?? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  clerkProxyUrl:
    injected?.clerkProxyUrl ?? import.meta.env.VITE_CLERK_PROXY_URL,
  sitePasscode:
    injected?.sitePasscode ??
    (import.meta.env.VITE_SITE_PASSCODE as string | undefined),
  resendConfigured:
    injected?.resendConfigured ?? Boolean(import.meta.env.VITE_RESEND_CONFIGURED),
};
