"use client";

import { useState } from "react";
import {
  Sliders,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";

export interface GlobalConfigItem {
  id: string;
  configVersion: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  originalFileName: string;
  fileSizeBytes: number;
  createdAt: string;
  activatedAt?: string | null;
  uploadedByAdmin?: { username: string } | null;
  activatedByAdmin?: { username: string } | null;
}

export interface GlobalConfigViewProps {
  initialConfigs: GlobalConfigItem[];
}

export function GlobalConfigView({ initialConfigs }: GlobalConfigViewProps) {
  const { showToast } = useToast();

  const [configs, setConfigs] = useState<GlobalConfigItem[]>(initialConfigs);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Form state
  const [versionInput, setVersionInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeConfig = configs.find((c) => c.status === "ACTIVE");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!selectedFile) {
      setFormError("Please choose a configuration file.");
      return;
    }
    if (!versionInput.trim()) {
      setFormError("Please specify a semver version string.");
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("configVersion", versionInput.trim());
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/configuration", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to upload configuration.");
      }

      setConfigs((prev) => [data.configuration, ...prev]);
      setVersionInput("");
      setSelectedFile(null);
      // Reset file input element
      const fileInput = document.getElementById("config-file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      showToast({
        variant: "success",
        title: "Configuration Uploaded",
        message: `Version ${data.configuration.configVersion} uploaded successfully.`,
      });
    } catch (err: any) {
      setFormError(err.message || "Failed to upload configuration.");
      showToast({
        variant: "error",
        title: "Upload Failed",
        message: err.message || "Failed to upload configuration.",
      });
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleActivate(configId: string) {
    setActivatingId(configId);
    try {
      const res = await fetch(`/api/admin/configuration/${configId}/activate`, {
        method: "POST",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to activate configuration.");
      }

      setConfigs((prev) =>
        prev.map((c) => {
          if (c.id === configId) {
            return {
              ...c,
              status: "ACTIVE",
              activatedAt: new Date().toISOString(),
            };
          }
          if (c.status === "ACTIVE") {
            return {
              ...c,
              status: "ARCHIVED",
            };
          }
          return c;
        })
      );

      showToast({
        variant: "success",
        title: "Configuration Activated",
        message: `Version ${data.data?.activated?.configVersion || ""} is now active globally.`,
      });
    } catch (err: any) {
      showToast({
        variant: "error",
        title: "Activation Failed",
        message: err.message || "Failed to activate configuration.",
      });
    } finally {
      setActivatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="h-6 w-6 text-accent-600" />
          Configuration Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage the global configuration distributed to all registered sensors.
        </p>
      </div>

      {/* Active Config Banner Card */}
      <Card className="p-6 border-accent-200 bg-gradient-to-r from-accent-50/50 to-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent-100 flex items-center justify-center text-accent-700 shrink-0">
              <FileCode2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">Active Global Configuration</h2>
                {activeConfig ? (
                  <Badge variant="success">Active</Badge>
                ) : (
                  <Badge variant="neutral">None Active</Badge>
                )}
              </div>
              {activeConfig ? (
                <div className="mt-2 text-sm text-slate-700 space-y-1">
                  <p>
                    <span className="text-slate-500">Version:</span>{" "}
                    <code className="font-mono font-semibold text-accent-700 bg-accent-100/60 px-1.5 py-0.5 rounded">
                      {activeConfig.configVersion}
                    </code>{" "}
                    &bull; <span className="text-slate-500">File:</span> {activeConfig.originalFileName} (
                    {formatFileSize(activeConfig.fileSizeBytes)})
                  </p>
                  <p className="text-xs text-slate-500">
                    Activated at:{" "}
                    {activeConfig.activatedAt
                      ? formatUploadTimestamp(new Date(activeConfig.activatedAt)).combined
                      : "Recently"}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  No active configuration currently deployed. Upload a new configuration file below and activate it.
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Upload Form Card */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent-600" />
          Upload New Configuration Version
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Configurations must follow strict semantic versioning (e.g. 1.0.0). New versions must be strictly greater than the currently active version.
        </p>

        {formError && (
          <div className="mb-4 flex items-center gap-2 p-3 text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Version (semver, e.g. 1.0.0)
            </label>
            <Input
              type="text"
              placeholder={activeConfig ? `> ${activeConfig.configVersion}` : "1.0.0"}
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Configuration File
            </label>
            <Input
              id="config-file-input"
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              required
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={uploadLoading}
            >
              {uploadLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Upload Configuration
            </Button>
          </div>
        </form>
      </Card>

      {/* Configurations History Table */}
      <Card className="overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">Configuration History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            All uploaded global configurations, ordered newest first.
          </p>
        </div>

        {configs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Sliders className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="font-medium">No configurations uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the upload form above to add the initial configuration version.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded At</th>
                  <th className="py-3 px-4">Activated At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {configs.map((cfg) => {
                  const isActive = cfg.status === "ACTIVE";
                  return (
                    <tr
                      key={cfg.id}
                      className={isActive ? "bg-accent-50/30 font-medium" : "hover:bg-slate-50/50"}
                    >
                      <td className="py-3 px-4 font-mono text-slate-900">
                        {cfg.configVersion}
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : cfg.status === "ARCHIVED" ? (
                          <Badge variant="neutral">Archived</Badge>
                        ) : (
                          <Badge variant="neutral">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{cfg.originalFileName}</td>
                      <td className="py-3 px-4 text-slate-500">{formatFileSize(cfg.fileSizeBytes)}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {formatUploadTimestamp(new Date(cfg.createdAt)).dateLabel}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {cfg.activatedAt
                          ? formatUploadTimestamp(new Date(cfg.activatedAt)).dateLabel
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Currently Active
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={activatingId === cfg.id}
                            onClick={() => handleActivate(cfg.id)}
                          >
                            {activatingId === cfg.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Activate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
