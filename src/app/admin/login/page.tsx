import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthorizedAdmin } from "@/lib/auth/guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin Login — FileVault",
};

export default async function AdminLoginPage() {
  const admin = await getAuthorizedAdmin();
  if (admin) {
    redirect("/admin/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold tracking-tight text-white">FileVault</p>
          <p className="text-xs text-slate-400">Admin dashboard</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your admin credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
