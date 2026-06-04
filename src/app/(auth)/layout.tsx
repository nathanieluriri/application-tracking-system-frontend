import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-secondary px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
