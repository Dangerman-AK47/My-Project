import type { UploadApiResponse } from "@/lib/upload/types";

// Uses XMLHttpRequest rather than fetch specifically because it exposes
// real `upload.onprogress` events cross-browser, which is what drives the
// progress bar — the Fetch API has no equivalent for outgoing request
// bodies. Only ever imported from client components.

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload canceled.");
    this.name = "UploadAbortedError";
  }
}

export function uploadFileWithProgress(
  deviceId: string,
  file: File,
  onProgress: (percent: number) => void,
  onXhrReady?: (xhr: XMLHttpRequest) => void
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onXhrReady?.(xhr);

    xhr.open("POST", "/api/v1/sensors/upload");
    xhr.responseType = "text";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText) as UploadApiResponse;
        resolve(parsed);
      } catch {
        reject(new Error("Received an unexpected response from the server."));
      }
    };

    xhr.onerror = () => reject(new Error("A network error occurred during the upload."));
    xhr.onabort = () => reject(new UploadAbortedError());

    const formData = new FormData();
    formData.append("deviceId", deviceId);
    formData.append("file", file);
    xhr.send(formData);
  });
}
