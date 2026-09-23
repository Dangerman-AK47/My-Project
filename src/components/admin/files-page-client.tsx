"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileStack, Trash2, Download, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { TableSkeleton } from "./skeletons";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";

export interface UploadedFileItem {
  id: string;
  uploadRecordId: string;
  deviceId: string;
  originalFileName: string;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadStatus: string;
  storageKey: string;
}

export interface FilesPageClientProps {
  initialFiles: UploadedFileItem[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
}

const SEARCH_DEBOUNCE_MS = 350;

export function FilesPageClient({
  initialFiles,
  initialTotal,
  initialPage,
  pageSize,
}: FilesPageClientProps) {
  const { showToast } = useToast();

  const [files, setFiles] = useState<UploadedFileItem[]>(initialFiles);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const didMountRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchFiles = useCallback(
    async (params: { search: string; page: number }) => {
      setLoading(true);
      try {
        const url = new URL("/api/admin/files", window.location.origin);
        if (params.search) url.searchParams.set("q", params.search);
        url.searchParams.set("page", String(params.page));
        url.searchParams.set("pageSize", String(pageSize));
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error();
        const json = await res.json();
        setFiles(json.files);
        setTotal(json.total);
        setPage(json.page);
      } catch {
        showToast({ variant: "error", message: "Could not load files. Please try again." });
      } finally {
        setLoading(false);
      }
    },
    [pageSize, showToast]
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    void fetchFiles({ search: appliedSearch, page });
  }, [appliedSearch, page, fetchFiles]);

  async function handleDelete(fileId: string) {
    setDeletingId(fileId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/admin/files/${fileId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to delete file.");
      setFiles((current) => current.filter((f) => f.id !== fileId));
      setTotal((t) => t - 1);
      showToast({ variant: "success", title: "File deleted", message: "The file record has been removed." });
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to delete file.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDownload(file: UploadedFileItem) {
    setDownloadingId(file.id);
    try {
      const res = await fetch(`/api/admin/files/${file.id}`);
      if (!res.ok) throw new Error("Failed to download file.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast({
        variant: "error",
        message: err instanceof Error ? err.message : "Failed to download file.",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  const confirmFile = confirmDeleteId ? files.find((f) => f.id === confirmDeleteId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative max-w-md">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by filename, Device ID, or Upload ID…"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          aria-label="Search uploaded files"
        />
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={pageSize} columns={7} />
        ) : files.length === 0 ? (
          <EmptyState
            message={
              appliedSearch ? "No files match your search." : "No files have been uploaded yet."
            }
            icon={FileStack}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Device ID</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3">Upload ID</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate" title={file.originalFileName}>
                      {file.originalFileName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{file.deviceId}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[120px] truncate" title={file.mimeType}>
                      {file.mimeType}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatFileSize(file.fileSizeBytes)}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {formatUploadTimestamp(new Date(file.uploadedAt)).combined}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{file.uploadRecordId}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-accent-700"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file.id}
                          aria-label={`Download ${file.originalFileName}`}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-danger-600"
                          onClick={() => setConfirmDeleteId(file.id)}
                          disabled={deletingId === file.id}
                          aria-label={`Delete ${file.originalFileName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!loading && files.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}

      {/* Delete confirmation modal */}
      {confirmFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-file-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-100">
                <Trash2 className="h-5 w-5 text-danger-600" aria-hidden="true" />
              </div>
              <div>
                <h2 id="delete-file-title" className="text-base font-semibold text-slate-900">
                  Delete File
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Permanently delete{" "}
                  <span className="font-medium text-slate-800">{confirmFile.originalFileName}</span>?
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(confirmFile.id)}
                disabled={deletingId === confirmFile.id}
              >
                Delete File
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
