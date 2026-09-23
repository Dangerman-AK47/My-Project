"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Cpu,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Sliders,
  UploadCloud,
  FileCheck2,
  Lock,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { parseDeviceId } from "@/lib/validation/device-id";

export function RegistrationPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  const sampleIds = ["SENSOR-WAREHOUSE-01", "DEV-ENABLED-001", "GATEWAY-NODE-03"];

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validation = parseDeviceId(deviceId);
    if (!validation.success) {
      setError(validation.error);
      return;
    }

    const normalizedId = validation.value;
    setLoading(true);

    try {
      const res = await fetch("/api/v1/sensors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: normalizedId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to register sensor.");
      }

      // Save token and sensor ID in sessionStorage so the portal can authenticate
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sensorId", data.sensorId || normalizedId);
        sessionStorage.setItem("sensorToken", data.token || "");
      }

      setRegisteredSuccess(true);
      showToast({
        variant: "success",
        title: "Registration Approved",
        message: `Sensor ${normalizedId} auto-approved. Redirecting to sensor options...`,
      });

      setTimeout(() => {
        router.push("/portal");
      }, 600);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
      showToast({
        variant: "error",
        title: "Registration Failed",
        message: err.message || "Could not register sensor.",
      });
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm shadow-accent-600/25">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 text-base">FileVault</span>
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 border border-slate-200">
                Sensor Platform v3
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="hidden sm:flex items-center gap-1.5 text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              API Services Online
            </div>
            <Link
              href="/upload"
              className="text-slate-600 hover:text-slate-900 hover:underline"
            >
              Data Upload
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
            >
              Admin Dashboard &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero & Registration Container */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Context & Feature Highlights */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50/80 px-3 py-1 text-xs font-semibold text-accent-700">
              <Zap className="h-3.5 w-3.5 text-accent-600" />
              <span>Instant Auto-Approval Workflow</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
              Sensor Registration & Management
            </h1>

            <p className="text-base text-slate-600 leading-relaxed">
              Register your sensor or IoT device ID to gain immediate, autonomous access to the configuration management platform, version checks, and telemetry uploads.
            </p>

            {/* 3 Step Features */}
            <div className="grid grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <UploadCloud className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">1. Upload Files</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Stream sensor readings, CSV logs, and JSON payloads.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">2. Version Check</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Verify semver compatibility against active global configs.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                  <Sliders className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">3. Sync Config</h2>
                <p className="mt-1 text-xs text-slate-500">
                  One-click binary configuration payload downloads.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Registration Card */}
          <div className="lg:col-span-6">
            <Card className="rounded-2xl border-slate-200 shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50/70 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-900 text-lg">
                    <ShieldCheck className="h-5 w-5 text-accent-600" />
                    <span>Registration</span>
                  </div>
                  <Badge variant="success">Auto-Approved</Badge>
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  Provide your Device ID below. Registration requires only this ID and is approved automatically without waiting.
                </p>
              </div>

              <CardContent className="p-6 sm:p-8 space-y-6">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label htmlFor="deviceId" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                      Device ID / Sensor ID
                    </label>
                    <div className="relative">
                      <Input
                        id="deviceId"
                        type="text"
                        placeholder="e.g. SENSOR-WAREHOUSE-01"
                        value={deviceId}
                        onChange={(e) => {
                          setDeviceId(e.target.value);
                          if (error) setError(null);
                        }}
                        disabled={loading || registeredSuccess}
                        className="h-11 font-mono uppercase text-sm tracking-wide pl-3.5 pr-10 border-slate-300 focus:border-accent-500 focus:ring-accent-500"
                        autoFocus
                        required
                      />
                      <Cpu className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>

                    {error && (
                      <p className="mt-2 text-xs font-medium text-danger-600 flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        {error}
                      </p>
                    )}

                    {/* Quick-fill sample sensor chips */}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-medium">Try sample ID:</span>
                      {sampleIds.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            setDeviceId(id);
                            setError(null);
                          }}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-11 text-sm font-semibold shadow-md shadow-accent-600/20"
                    disabled={loading || registeredSuccess || !deviceId.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Approving & Generating Token...
                      </>
                    ) : registeredSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approved! Loading Portal...
                      </>
                    ) : (
                      <>
                        Register & Continue
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                {/* Info callout */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 text-xs text-slate-600 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                    <Layers className="h-4 w-4 text-accent-600" />
                    Autonomous Workflow
                  </div>
                  <p className="leading-relaxed text-slate-500">
                    Once submitted, you will be redirected to the sensor options portal with your security bearer token to <strong>upload files</strong>, <strong>check active configurations</strong>, and <strong>download configuration packages</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p>&copy; {new Date().getFullYear()} FileVault Sensor Platform &bull; All Rights Reserved</p>
          <div className="flex items-center gap-4">
            <Link href="/admin/login" className="font-semibold text-slate-700 hover:text-accent-600 hover:underline">
              Admin Portal Login &rarr;
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
