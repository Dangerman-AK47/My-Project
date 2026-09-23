"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  UploadCloud,
  CheckCircle,
  DownloadCloud,
  Cpu,
  KeyRound,
  Copy,
  Loader2,
  FileCheck2,
  FileText,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Check,
  FileUp,
  Sliders,
  ShieldCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatFileSize } from "@/lib/upload/format";

type TabType = "upload" | "version_check" | "download";

export function SensorPortalView() {
  const { showToast } = useToast();

  const [sensorId, setSensorId] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabType>("upload");
  const [showToken, setShowToken] = useState(false);
  const [installedVersion, setInstalledVersion] = useState<string | null>(null);
  const [loadingSensorVersion, setLoadingSensorVersion] = useState(false);

  async function fetchSensorStatus(id: string, bearerToken?: string) {
    if (!id) return;
    setLoadingSensorVersion(true);
    try {
      const headers: Record<string, string> = {};
      if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
      const res = await fetch(`/portal/check?sensorId=${encodeURIComponent(id)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.currentVersion) {
          setInstalledVersion(data.currentVersion);
          setCurrentVersionInput(data.currentVersion);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sensor current version:", err);
    } finally {
      setLoadingSensorVersion(false);
    }
  }

  // Load sensor ID and token from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedId = sessionStorage.getItem("sensorId");
      const storedToken = sessionStorage.getItem("sensorToken");
      if (storedId) {
        setSensorId(storedId);
        void fetchSensorStatus(storedId, storedToken || undefined);
      }
      if (storedToken) setToken(storedToken);
    }
  }, []);

  const [copiedToken, setCopiedToken] = useState(false);

  // ----------------------------------------------------
  // Option 1: Upload State
  // ----------------------------------------------------
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      showToast({ variant: "error", message: "Please select a file to upload." });
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("sensorId", sensorId);

      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      setUploadProgress(45);
      const res = await fetch("/portal/upload", {
        method: "POST",
        headers,
        body: formData,
      });

      setUploadProgress(85);
      const json = await res.json();

      if (!res.ok || json.status !== "success") {
        throw new Error(json.message || "Upload failed.");
      }

      setUploadProgress(100);
      setUploadResult(json.data);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      showToast({
        variant: "success",
        title: "Upload Succeeded",
        message: `File "${json.data.originalFileName}" was saved successfully.`,
      });
    } catch (err: any) {
      showToast({
        variant: "error",
        title: "Upload Failed",
        message: err.message || "Failed to upload file.",
      });
    } finally {
      setUploading(false);
    }
  }

  // ----------------------------------------------------
  // Option 2: Version Check State
  // ----------------------------------------------------
  const [currentVersionInput, setCurrentVersionInput] = useState("");
  const [checkingVersion, setCheckingVersion] = useState(false);
  const [versionOutcome, setVersionOutcome] = useState<{
    result: string;
    activeConfigVersion: string | null;
    message: string;
  } | null>(null);

  async function handleCheckVersion(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setCheckingVersion(true);
    setVersionOutcome(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/portal/check", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sensorId,
          currentConfigVersion: installedVersion || "0.0.0",
        }),
      });

      const json = await res.json();
      setVersionOutcome(json);

      if (json.result === "UPDATE_AVAILABLE") {
        showToast({
          variant: "info",
          title: "Update Available",
          message: `Active configuration version ${json.activeConfigVersion} is available.`,
        });
      } else if (json.result === "CURRENT") {
        showToast({
          variant: "success",
          title: "Up to Date",
          message: "Sensor configuration is current.",
        });
      } else {
        showToast({
          variant: "info",
          title: "Version Check Complete",
          message: json.message || json.result,
        });
      }
    } catch (err: any) {
      showToast({
        variant: "error",
        title: "Version Check Failed",
        message: err.message || "Failed to check configuration.",
      });
    } finally {
      setCheckingVersion(false);
    }
  }

  // ----------------------------------------------------
  // Option 3: Download Config State
  // ----------------------------------------------------
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  async function handleDownloadConfig() {
    setDownloading(true);
    setDownloadSuccess(null);

    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const downloadUrl = sensorId
        ? `/portal/download?sensorId=${encodeURIComponent(sensorId)}`
        : "/portal/download";

      const res = await fetch(downloadUrl, {
        method: "GET",
        headers,
      });

      if (!res.ok) {
        let errMessage = "Failed to download configuration.";
        try {
          const json = await res.json();
          errMessage = json.message || errMessage;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const disposition = res.headers.get("content-disposition");
      let filename = "config.json";
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^";]+)"?/);
        if (match?.[1]) filename = decodeURIComponent(match[1]);
      }

      const versionHeader = res.headers.get("x-config-version");
      if (versionHeader) {
        setInstalledVersion(versionHeader);
        setCurrentVersionInput(versionHeader);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const msg = `Downloaded "${filename}" ${versionHeader ? `(v${versionHeader})` : ""}. Sensor's current version was automatically updated to v${versionHeader || "latest"}.`;
      setDownloadSuccess(msg);
      showToast({
        variant: "success",
        title: "Download Complete & Version Updated",
        message: msg,
      });

      // Refresh sensor state from DB
      if (sensorId) {
        void fetchSensorStatus(sensorId, token);
      }
    } catch (err: any) {
      showToast({
        variant: "error",
        title: "Download Failed",
        message: err.message || "Could not download configuration file.",
      });
    } finally {
      setDownloading(false);
    }
  }

  function handleCopyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
    showToast({ variant: "success", title: "Copied", message: "Bearer token copied to clipboard." });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Application Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-600 text-white shadow-sm shadow-accent-600/25 group-hover:bg-accent-700 transition-colors">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-slate-900 text-base">FileVault</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 border border-slate-200">
                  Sensor Portal
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Register Different Sensor
            </Link>
            <Link
              href="/admin"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Admin Dashboard &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {/* Sensor Identity Hero Card */}
        <div className="mb-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 border border-accent-100 shrink-0">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {sensorId || "Registered Sensor"}
                  </h1>
                  <Badge variant="success">ACTIVE</Badge>
                  <Badge variant="neutral">Auto-Approved</Badge>
                  {installedVersion ? (
                    <Badge variant="neutral" className="font-mono text-accent-700 bg-accent-50 border-accent-200">
                      v{installedVersion}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="font-mono text-slate-500">
                      v0.0.0 (Unconfigured)
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Authenticated session. Choose from the three options below to upload files, check configuration semver, or download active configurations.
                </p>
              </div>
            </div>

            {/* Token Badge with Quick Copy */}
            {token && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <KeyRound className="h-3.5 w-3.5 text-accent-600 shrink-0" />
                <span className="font-mono text-slate-700">
                  {showToken ? token : `${token.slice(0, 12)}...${token.slice(-6)}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  title={showToken ? "Hide Token" : "Reveal Token"}
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="text-slate-500 hover:text-accent-600 font-semibold flex items-center gap-1 border-l border-slate-200 pl-2 ml-1"
                >
                  {copiedToken ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedToken ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3 Option Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`group text-left rounded-2xl border p-5 transition-all ${
              activeTab === "upload"
                ? "bg-accent-600 text-white border-accent-600 shadow-lg shadow-accent-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  activeTab === "upload" ? "bg-white/20 text-white" : "bg-accent-50 text-accent-600"
                }`}
              >
                <UploadCloud className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${activeTab === "upload" ? "text-accent-100" : "text-slate-400"}`}>
                Option 1
              </span>
            </div>
            <h2 className="text-base font-bold">Upload Data File</h2>
            <p className={`mt-1 text-xs leading-relaxed ${activeTab === "upload" ? "text-accent-100" : "text-slate-500"}`}>
              Ingest sensor logs, metrics, CSV, or payload data with verified identity.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("version_check")}
            className={`group text-left rounded-2xl border p-5 transition-all ${
              activeTab === "version_check"
                ? "bg-accent-600 text-white border-accent-600 shadow-lg shadow-accent-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  activeTab === "version_check" ? "bg-white/20 text-white" : "bg-accent-50 text-accent-600"
                }`}
              >
                <FileCheck2 className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${activeTab === "version_check" ? "text-accent-100" : "text-slate-400"}`}>
                Option 2
              </span>
            </div>
            <h2 className="text-base font-bold">Check Configuration</h2>
            <p className={`mt-1 text-xs leading-relaxed ${activeTab === "version_check" ? "text-accent-100" : "text-slate-500"}`}>
              Verify installed semver against active server configuration.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("download")}
            className={`group text-left rounded-2xl border p-5 transition-all ${
              activeTab === "download"
                ? "bg-accent-600 text-white border-accent-600 shadow-lg shadow-accent-600/20"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  activeTab === "download" ? "bg-white/20 text-white" : "bg-accent-50 text-accent-600"
                }`}
              >
                <DownloadCloud className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${activeTab === "download" ? "text-accent-100" : "text-slate-400"}`}>
                Option 3
              </span>
            </div>
            <h2 className="text-base font-bold">Download Config File</h2>
            <p className={`mt-1 text-xs leading-relaxed ${activeTab === "download" ? "text-accent-100" : "text-slate-500"}`}>
              Stream the active global configuration binary directly to this device.
            </p>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* OPTION 1: UPLOAD FILE SECTION */}
        {/* ========================================================================= */}
        {activeTab === "upload" && (
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-accent-600" />
                Upload Data File
              </CardTitle>
              <CardDescription>
                Files are securely recorded with your registered Sensor ID (<span className="font-mono text-slate-800 font-semibold">{sensorId}</span>) and hashed for tamper verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <form onSubmit={handleFileUpload} className="space-y-6">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      setUploadFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                    isDragOver
                      ? "border-accent-500 bg-accent-50/50 scale-[1.01]"
                      : uploadFile
                      ? "border-success-400 bg-success-50/20"
                      : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    disabled={uploading}
                  />

                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200 text-slate-600">
                    {uploadFile ? (
                      <FileUp className="h-7 w-7 text-success-600" />
                    ) : (
                      <UploadCloud className="h-7 w-7 text-accent-600" />
                    )}
                  </div>

                  {uploadFile ? (
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{uploadFile.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatFileSize(uploadFile.size)}</p>
                      <span className="mt-2 inline-block rounded-full bg-success-100 text-success-800 px-3 py-0.5 text-xs font-semibold">
                        Ready to upload
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">
                        Click to select or drag and drop a file
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Supports CSV, JSON, binary packages, text logs up to 100 MB
                      </p>
                    </div>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                      <span>Uploading to server...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-accent-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    className="h-11 px-6 font-semibold"
                    disabled={uploading || !uploadFile}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading Payload...
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4 mr-2" />
                        Submit File Upload
                      </>
                    )}
                  </Button>
                </div>
              </form>

              {/* Upload Success Receipt */}
              {uploadResult && (
                <div className="rounded-xl border border-success-200 bg-success-50/70 p-5 text-xs text-success-900 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm text-success-800">
                    <CheckCircle className="h-5 w-5 text-success-600" />
                    File Upload Stored Successfully
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-mono text-slate-800 bg-white/80 p-3.5 rounded-lg border border-success-200/60">
                    <div>
                      <span className="text-slate-400">Record ID: </span>
                      {uploadResult.uploadId}
                    </div>
                    <div>
                      <span className="text-slate-400">Sensor ID: </span>
                      {uploadResult.deviceId}
                    </div>
                    <div>
                      <span className="text-slate-400">File Name: </span>
                      {uploadResult.originalFileName}
                    </div>
                    <div>
                      <span className="text-slate-400">File Size: </span>
                      {formatFileSize(uploadResult.fileSizeBytes)}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* OPTION 2: CHECK CONFIGURATION SECTION */}
        {/* ========================================================================= */}
        {activeTab === "version_check" && (
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-accent-600" />
                Check Configuration Version
              </CardTitle>
              <CardDescription>
                Compare your sensor&apos;s current running configuration against the platform&apos;s active global configuration version.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <form onSubmit={handleCheckVersion} className="max-w-lg space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="currentVersion" className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-accent-600" />
                      Currently Installed Semver Version (Read-Only)
                    </label>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
                      Uneditable &bull; Auto-Managed
                    </span>
                  </div>
                  <Input
                    id="currentVersion"
                    type="text"
                    readOnly
                    disabled
                    value={installedVersion || "No configuration downloaded yet (0.0.0)"}
                    className="h-11 font-mono text-sm bg-slate-100 text-slate-800 cursor-not-allowed border-slate-300 font-semibold select-all"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    This value cannot be manually edited. It automatically updates to match the configuration file version whenever this sensor downloads an active configuration.
                  </p>
                </div>

                <Button type="submit" variant="primary" className="h-11 px-6 font-semibold" disabled={checkingVersion || loadingSensorVersion}>
                  {checkingVersion ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Evaluating Version Status...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Run Version Check
                    </>
                  )}
                </Button>
              </form>

              {/* Version Check Outcome Display */}
              {versionOutcome && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Assessment Result
                    </span>
                    {versionOutcome.result === "CURRENT" ? (
                      <Badge variant="success">Up to Date (CURRENT)</Badge>
                    ) : versionOutcome.result === "UPDATE_AVAILABLE" ? (
                      <Badge variant="warning">Update Available</Badge>
                    ) : versionOutcome.result === "NO_CONFIGURATION_AVAILABLE" ? (
                      <Badge variant="neutral">No Config Published</Badge>
                    ) : (
                      <Badge variant="danger">{versionOutcome.result}</Badge>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-900">{versionOutcome.message}</p>

                  {versionOutcome.activeConfigVersion && (
                    <div className="rounded-lg bg-white p-4 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Server Active Global Version:</span>
                      <code className="font-mono font-bold text-accent-700 bg-accent-50 px-2.5 py-1 rounded text-sm border border-accent-200">
                        v{versionOutcome.activeConfigVersion}
                      </code>
                    </div>
                  )}

                  {versionOutcome.result === "UPDATE_AVAILABLE" && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="primary"
                        className="h-10 px-5 text-xs font-semibold"
                        onClick={() => {
                          setActiveTab("download");
                          void handleDownloadConfig();
                        }}
                      >
                        <DownloadCloud className="h-4 w-4 mr-2" />
                        Download Update Package (v{versionOutcome.activeConfigVersion})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ========================================================================= */}
        {/* OPTION 3: DOWNLOAD CONFIGURATION SECTION */}
        {/* ========================================================================= */}
        {activeTab === "download" && (
          <Card className="rounded-2xl border-slate-200 shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <DownloadCloud className="h-5 w-5 text-accent-600" />
                Download Configuration File
              </CardTitle>
              <CardDescription>
                Download the official configuration package currently marked as <span className="font-bold text-success-700">ACTIVE</span> by the system administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="rounded-2xl bg-slate-50/80 p-6 border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                  <FileText className="h-5 w-5 text-accent-600" />
                  Active Global Configuration Package
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Downloads the server-side configuration binary file for your sensor. Your authenticated sensor token is verified, and a download event is logged in the telemetry database for fleet tracking.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <Badge variant="success">Global Scope</Badge>
                  <Badge variant="neutral">Direct Binary Stream</Badge>
                </div>
              </div>

              <div>
                <Button
                  type="button"
                  variant="primary"
                  className="h-11 px-6 font-semibold"
                  onClick={handleDownloadConfig}
                  disabled={downloading}
                >
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Streaming Configuration File...
                    </>
                  ) : (
                    <>
                      <DownloadCloud className="h-4 w-4 mr-2" />
                      Download Active Configuration
                    </>
                  )}
                </Button>
              </div>

              {downloadSuccess && (
                <div className="rounded-xl border border-success-200 bg-success-50/80 p-4 text-xs text-success-900 flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-success-600 shrink-0" />
                  <span className="font-medium">{downloadSuccess} successfully saved to your device.</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p>Sensor Platform v3 &bull; Sensor Portal for <span className="font-mono text-slate-800 font-bold">{sensorId}</span></p>
          <Link href="/admin" className="font-semibold text-slate-700 hover:text-accent-600 hover:underline">
            Go to Admin Dashboard &rarr;
          </Link>
        </div>
      </footer>
    </div>
  );
}
