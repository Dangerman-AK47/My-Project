import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize, formatUploadTimestamp } from "@/lib/upload/format";
import type { UploadSuccessData } from "@/lib/upload/types";

export interface UploadSuccessPanelProps {
  data: UploadSuccessData;
  onUploadAnother: () => void;
}

export function UploadSuccessPanel({ data, onUploadAnother }: UploadSuccessPanelProps) {
  const { combined } = formatUploadTimestamp(new Date(data.uploadedAt));

  const rows: Array<[string, string]> = [
    ["Device ID", data.deviceId],
    ["File name", data.originalFileName],
    ["File type", data.mimeType],
    ["File size", formatFileSize(data.fileSizeBytes)],
    ["Uploaded", combined],
    ["Upload ID", data.uploadId],
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <CheckCircle2 className="h-5 w-5 text-success-500" aria-hidden="true" />
        <CardTitle>File uploaded successfully</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2 text-sm">
              <dt className="text-slate-500">{label}</dt>
              <dd className="truncate font-medium text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>

        <Button type="button" onClick={onUploadAnother} className="mt-5 w-full">
          Upload another file
        </Button>
      </CardContent>
    </Card>
  );
}
