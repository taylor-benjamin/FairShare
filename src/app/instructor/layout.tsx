import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { requireUser } from "@/lib/auth/session";

export default async function InstructorLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(["instructor"]);
  return (
    <>
      <AppNav user={user} />
      {children}
    </>
  );
}
