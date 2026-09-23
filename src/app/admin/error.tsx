"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin portal error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-8 shadow-2xl text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertCircle className="h-7 w-7" />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Admin Portal Exception
          </h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            A temporary issue occurred while loading this view. You can reload the page or re-authenticate.
          </p>
          {error?.message && (
            <div className="mt-3 rounded-lg bg-slate-900 border border-slate-800 p-3 text-left font-mono text-[11px] text-rose-300 break-words">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            variant="primary"
            className="w-full h-10 font-semibold"
            onClick={() => reset()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>

          <Link
            href="/admin/login"
            className="inline-flex w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Return to Admin Login
          </Link>
        </div>

        {error?.digest && (
          <p className="text-[10px] text-slate-600 font-mono">
            Error Reference Digest: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
