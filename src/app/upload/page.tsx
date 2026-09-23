import type { Metadata } from "next";
import { PublicUploadPage } from "@/components/upload/public-upload-page";

export const metadata: Metadata = {
  title: "FileVault — Upload",
};

export default function UploadPage() {
  return <PublicUploadPage />;
}
