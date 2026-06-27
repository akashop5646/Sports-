import { createFileRoute, redirect } from "@tanstack/react-router";
import { completeGoogleAuth } from "@/lib/auth";
import { z } from "zod";
import * as React from "react";

const searchSchema = z.object({
  code: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    code: search.code,
    error: search.error,
  }),
  loader: async ({ deps }) => {
    if (!deps.code) {
      throw redirect({ to: "/home" });
    }
    try {
      await completeGoogleAuth({ data: deps.code });
      return { success: true, error: null };
    } catch (e) {
      console.error("Google authentication error:", e);
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  },
  component: () => {
    const data = Route.useLoaderData();
    const navigate = Route.useNavigate();

    React.useEffect(() => {
      if (data.success) {
        navigate({ to: "/home" });
      }
    }, [data.success, navigate]);

    if (!data.success) {
      return (
        <div className="min-h-screen grid place-items-center bg-background text-foreground font-display p-6">
          <div className="max-w-md w-full text-center space-y-6 bg-elevated/50 border border-border p-8 rounded-3xl backdrop-blur-xl">
            <div className="h-12 w-12 rounded-full bg-destructive/10 border border-destructive/20 text-destructive grid place-items-center mx-auto text-xl font-bold">
              !
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Authentication Failed</h1>
              <p className="text-muted-foreground text-sm">
                We couldn't sign you in with Google. This is often due to a database connection
                timeout, IP whitelist block, or configuration mismatch.
              </p>
              {data.error && (
                <pre className="text-xs text-destructive bg-destructive/5 border border-destructive/10 p-3 rounded-xl overflow-x-auto text-left mt-4 max-h-40 whitespace-pre-wrap">
                  {data.error}
                </pre>
              )}
            </div>
            <button
              onClick={() => navigate({ to: "/home" })}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground font-display">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full border-t-2 border-primary animate-spin mx-auto" />
          <p className="text-muted-foreground animate-pulse">Completing sign in…</p>
        </div>
      </div>
    );
  },
});
