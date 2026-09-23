import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnv } from "@/lib/env";
import { UploadForm } from "./upload-form";

/**
 * The public device-upload page, rendered at both `/` and `/upload` (see
 * Part 3 brief). Reads MAX_FILE_SIZE_MB here, server-side, and passes it
 * down as a plain prop — avoids needing a NEXT_PUBLIC_ env var just to
 * share one number with the client form.
 */
export function PublicUploadPage() {
  const { MAX_FILE_SIZE_MB } = getEnv();

  return (
    <main className="flex min-h-screen flex-col bg-slate-50">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="text-sm font-semibold tracking-tight text-slate-900">FileVault</p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Secure device file upload
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Upload a file</CardTitle>
              <CardDescription>
                Enter your Device ID and choose a file to upload. Accepted up to {MAX_FILE_SIZE_MB}{" "}
                MB — any file type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm maxFileSizeMB={MAX_FILE_SIZE_MB} />
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-center">
        <a href="/admin/login" className="text-xs font-medium text-slate-400 hover:text-slate-600">
          Admin login
        </a>
      </footer>
    </main>
  );
}
