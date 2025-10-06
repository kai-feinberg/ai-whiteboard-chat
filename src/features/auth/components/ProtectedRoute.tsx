import { Authenticated, Unauthenticated } from "convex/react";
import { SignIn } from "./SignIn";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <SignIn />
      </Unauthenticated>
    </>
  );
}
