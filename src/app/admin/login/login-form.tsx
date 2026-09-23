"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { loginAction } from "./actions";
import { initialLoginFormState } from "./types";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" loading={pending} disabled={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialLoginFormState);
  const [showPassword, setShowPassword] = useState(false);
  const formState = state ?? initialLoginFormState;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {formState.status === "error" && formState.formError && (
        <Alert variant="danger">{formState.formError}</Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          invalid={Boolean(formState.fieldErrors?.username)}
        />
        {formState.fieldErrors?.username && (
          <p className="text-xs text-danger-500">{formState.fieldErrors.username}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            invalid={Boolean(formState.fieldErrors?.password)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {formState.fieldErrors?.password && (
          <p className="text-xs text-danger-500">{formState.fieldErrors.password}</p>
        )}
      </div>

      <SubmitButton />

      <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Secure admin session
      </p>
    </form>
  );
}
