/**
 * Barrel — exports the array of Inngest functions consumed by the
 * Vercel serve handler (api/inngest/[..route].ts, created elsewhere).
 */

export { auditRunner } from "./audit-runner.js";

import { auditRunner } from "./audit-runner.js";
export const functions = [auditRunner];
