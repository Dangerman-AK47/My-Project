"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/passwords";
import { createSession } from "@/lib/auth/guard";
import { recordAuditEvent, auditMetadataFromHeaders } from "@/lib/audit";
import type { LoginFormState } from "./types";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Generic on purpose: never reveal whether the username exists, whether
// the account is disabled, or that the password was wrong specifically.
const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password.";

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      fieldErrors: {
        username: fieldErrors.username?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const { username, password } = parsed.data;
  let redirectPath: string | null = null;

  try {
    const requestMeta = auditMetadataFromHeaders(headers());
    const account = await prisma.adminAccount.findUnique({ where: { username } });

    // Always run a bcrypt compare, even when no account was found, so the
    // response time doesn't leak whether the username exists.
    const passwordMatches = account
      ? await verifyPassword(password, account.passwordHash)
      : await verifyPassword(password, DUMMY_PASSWORD_HASH);

    if (!account || !account.isActive || !passwordMatches) {
      await recordAuditEvent({
        adminId: account?.id ?? null,
        action: "ADMIN_LOGIN_FAILURE",
        entityType: "AdminAccount",
        entityId: account?.id ?? null,
        metadata: { username },
        ...requestMeta,
      });
      return { status: "error", formError: INVALID_CREDENTIALS_MESSAGE };
    }

    await prisma.$transaction(async (tx) => {
      await tx.adminAccount.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
      });
      await recordAuditEvent(
        {
          adminId: account.id,
          action: "ADMIN_LOGIN_SUCCESS",
          entityType: "AdminAccount",
          entityId: account.id,
          ...requestMeta,
        },
        tx
      );
    });

    await createSession({ id: account.id, username: account.username, role: account.role });
    redirectPath = "/admin/dashboard";
  } catch (err) {
    console.error("Login action error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      formError: detail || "An unexpected error occurred during login. Please try again.",
    };
  }

  if (redirectPath) {
    redirect(redirectPath);
  }

  return { status: "idle" };
}
