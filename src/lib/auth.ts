import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Em produção, o AUTH_SECRET é obrigatório. Sem ele, os tokens JWT seriam
// assinados com um valor inseguro/aleatório a cada restart, invalidando
// sessões e abrindo brecha de segurança. Falhamos cedo em vez de rodar frágil.
//
// Durante o `next build` o módulo é avaliado com NODE_ENV=production (coleta
// de dados de página), mas o secret só é necessário em runtime. Detectamos a
// fase de build via NEXT_PHASE para não quebrar a compilação; em produção real
// (next start / Vercel) a validação continua ativa.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
if (
  process.env.NODE_ENV === "production" &&
  !isBuildPhase &&
  !process.env.AUTH_SECRET
) {
  throw new Error(
    "AUTH_SECRET é obrigatório em produção. Defina um valor forte (ex: openssl rand -base64 32).",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.toLowerCase().trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        // Força bruta: limita tentativas por e-mail na janela. A chave por
        // e-mail protege contas individuais mesmo atrás de CDN/load balancer.
        const rl = await rateLimit(`login:${email}`, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
        if (!rl.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER";
      }
      return session;
    },
  },
});