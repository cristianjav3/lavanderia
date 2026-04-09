import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

type UserRow = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  empresaId: string | null;
};

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Raw SQL to safely read empresaId even if ORM client wasn't regenerated
        const rows = await prisma.$queryRaw<UserRow[]>`
          SELECT id, name, email, password, role, "empresaId"
          FROM "User"
          WHERE email = ${credentials.email}
          LIMIT 1
        `;
        const user = rows[0];
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Resolve empresaId: use user's own, or fall back to the first empresa in the DB
        let empresaId = user.empresaId;
        if (!empresaId) {
          const empresa = await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Empresa" ORDER BY "createdAt" ASC LIMIT 1
          `;
          empresaId = empresa[0]?.id ?? null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role, empresaId };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: string; empresaId?: string | null };
        token.role = u.role;
        token.empresaId = u.empresaId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { id: string; role: string; empresaId: string | null }).id = token.sub!;
        (session.user as { id: string; role: string; empresaId: string | null }).role = token.role as string;
        (session.user as { id: string; role: string; empresaId: string | null }).empresaId =
          (token.empresaId as string | null) ?? null;
      }
      return session;
    },
  },
};
