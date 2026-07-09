"use client";

import { identify } from "@hellyeah/x-ray/next";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

export function XRayIdentify() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      identify(session.user.id, { email: session.user.email ?? undefined });
    }
  }, [session?.user?.id]);

  return null;
}
