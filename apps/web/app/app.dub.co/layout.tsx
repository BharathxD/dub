"use client";

import { ModalProvider } from "@/ui/modals/modal-provider";
import { XRayIdentify } from "@/ui/layout/xray-identify";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <XRayIdentify />
      <ModalProvider>{children}</ModalProvider>
    </SessionProvider>
  );
}
