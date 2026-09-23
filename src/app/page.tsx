import type { Metadata } from "next";
import { RegistrationPage } from "@/components/registration/registration-page";

export const metadata: Metadata = {
  title: "Registration — Sensor Platform",
};

export default function Home() {
  return <RegistrationPage />;
}
