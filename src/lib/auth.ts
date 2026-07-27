import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  // El identificador se normaliza a minúsculas: da igual cómo lo escriba
  // el usuario, y coincide con la forma en que se guardan usuario y correo.
  identifier: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
  remember: z.string().optional(),
});

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        identifier: { label: "Correo o usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
        remember: { label: "Recordarme", type: "checkbox" },
      },
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { identifier, password, remember } = parsed.data;
        const ipAddress = headerValue(request.headers?.["x-forwarded-for"])?.split(",")[0]?.trim();
        const userAgent = headerValue(request.headers?.["user-agent"]);
        const user = await db.user.findFirst({
          where: {
            OR: [
              { username: { equals: identifier, mode: "insensitive" } },
              { email: { equals: identifier, mode: "insensitive" } },
            ],
          },
        });
        const isLocked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
        const isValid = Boolean(user?.isActive && !isLocked && (await compare(password, user.passwordHash)));
        await db.loginAttempt.create({
          data: { username: identifier, success: isValid, ipAddress, userAgent },
        });
        if (!user || !isValid) {
          if (user && !isLocked) {
            const attempts = user.failedLoginAttempts + 1;
            await db.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: attempts,
                lockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
              },
            });
          }
          return null;
        }
        await db.$transaction([
          db.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
          }),
          db.auditLog.create({
            data: {
              userId: user.id,
              action: "LOGIN",
              entityType: "User",
              entityId: user.id,
              ipAddress,
              userAgent,
            },
          }),
        ]);
        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          username: user.username,
          role: user.role,
          authVersion: user.authVersion,
          expiresAt: Date.now() + (remember === "true" ? 30 * 86_400_000 : 12 * 3_600_000),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.username = user.username;
        token.role = user.role;
        token.authVersion = user.authVersion;
        token.expiresAt = user.expiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.authVersion = token.authVersion;
      session.user.expiresAt = token.expiresAt;
      return session;
    },
  },
};
