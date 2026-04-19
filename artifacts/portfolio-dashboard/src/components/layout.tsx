import { useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Layout({ children, onSignOut }: { children: React.ReactNode; onSignOut?: () => void }) {
  const { data: user, isLoading } = useGetMe();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center px-6">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <rect width="24" height="24" rx="4" fill="currentColor" />
                <rect x="6" y="6" width="4" height="12" rx="1" fill="white" />
                <rect x="14" y="6" width="4" height="12" rx="1" fill="white" />
              </svg>
              <span className="hidden font-bold sm:inline-block tracking-tight text-lg">
                Delivery <span className="text-muted-foreground font-normal">Dashboard</span>
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              {!isLoading && user?.isAuthenticated && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground font-medium hidden sm:inline-block">
                    {user.firstName ? `Editor: ${user.firstName}` : 'Editor Mode'}
                  </span>
                  {onSignOut && (
                    <Button variant="outline" size="sm" onClick={onSignOut}>
                      Sign out
                    </Button>
                  )}
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
