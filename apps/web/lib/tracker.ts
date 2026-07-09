import { createXRay } from "@hellyeah/x-ray/server";

export const TRACKER_ID =
  process.env.HELLYEAH_TRACKER_ID || "019f461c-d84e-7000-b65a-576cdb8fadd5";

export const tracker = createXRay(TRACKER_ID, {
  env: process.env.HELLYEAH_TRACKER_ENV,
});

export { cv } from "@hellyeah/x-ray/server";
