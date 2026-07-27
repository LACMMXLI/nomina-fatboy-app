import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      role: Role;
      authVersion: number;
      expiresAt: number;
    } & DefaultSession["user"];
  }

  interface User {
    username: string;
    role: Role;
    authVersion: number;
    expiresAt: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    username: string;
    role: Role;
    authVersion: number;
    expiresAt: number;
  }
}
