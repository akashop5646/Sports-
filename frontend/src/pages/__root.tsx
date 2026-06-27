import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Stadium Night — Cricket Tournaments, Live" },
      {
        name: "description",
        content:
          "Run cricket tournaments end-to-end: teams, fixtures, ball-by-ball scoring, certificates and live leaderboards.",
      },
      { name: "theme-color", content: "#0A1628" },
      { property: "og:title", content: "Stadium Night" },
      { property: "og:description", content: "Cricket tournaments, live scoring, certificates." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: () => <Outlet />,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="font-display text-7xl text-primary">404</div>
        <p className="text-muted-foreground mt-2">Page not found</p>
        <a
          href="/home"
          className="inline-block mt-4 px-4 py-2 rounded-lg gradient-lime text-primary-foreground font-semibold"
        >
          Go home
        </a>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <div className="font-display text-3xl">Something went wrong</div>
        <p className="text-muted-foreground mt-2 text-sm">{error.message}</p>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster position="top-center" theme="dark" />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
