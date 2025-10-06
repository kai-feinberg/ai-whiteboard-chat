import { useAuthActions } from "@convex-dev/auth/react";

export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <button
      onClick={() => void signOut()}
      className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-md border-2 border-transparent"
    >
      Sign Out
    </button>
  );
}
