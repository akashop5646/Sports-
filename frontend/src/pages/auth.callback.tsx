import { useNavigate, useSearchParams } from "react-router-dom";
import { completeGoogleAuth } from "@/lib/auth";
import * as React from "react";

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const navigate = useNavigate();

  const [status, setStatus] = React.useState<{
    success: boolean | null;
    error: string | null;
  }>({ success: null, error: null });

  const called = React.useRef(false);

  React.useEffect(() => {
    document.title = "Signing In — Stadium Night";

    if (!code) {
      navigate("/home");
      return;
    }

    if (called.current) return;
    called.current = true;

    const runAuth = async () => {
      try {
        await completeGoogleAuth(code);
        setStatus({ success: true, error: null });
        navigate("/home");
      } catch (e) {
        console.error("Google authentication error:", e);
        setStatus({
          success: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    };

    runAuth();
  }, [code, navigate]);

  if (status.success === false) {
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
            {status.error && (
              <pre className="text-xs text-destructive bg-destructive/5 border border-destructive/10 p-3 rounded-xl overflow-x-auto text-left mt-4 max-h-40 whitespace-pre-wrap">
                {status.error}
              </pre>
            )}
          </div>
          <button
            onClick={() => navigate("/home")}
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
}
