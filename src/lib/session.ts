import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

export async function getAuthUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.name ?? "",
    role: u.role ?? "USER",
  };
}

/** Para server components/páginas: redireciona para /login se não autenticado. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

/** Para páginas admin: redireciona para a home se não for admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}