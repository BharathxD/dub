"use client";

import { XRayIdentify } from "@/ui/layout/xray-identify";
import { SessionProvider } from "next-auth/react";
import { ReactNode, Suspense } from "react";

export default function PartnersLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <XRayIdentify />
      <Suspense>{children}</Suspense>
    </SessionProvider>
  );
}
