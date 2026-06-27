import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("stadium-night-app");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.state?.user) throw redirect({ to: "/home" });
      if (parsed?.state?.onboarded) throw redirect({ to: "/home" });
    }
    throw redirect({ to: "/onboarding" });
  },
  component: () => null,
});
