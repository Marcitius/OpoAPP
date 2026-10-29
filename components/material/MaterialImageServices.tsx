"use client";
import { createContext } from "react";
import {
  attachmentBlob,
  attachmentUrl,
  uploadAttachment,
} from "../../lib/data/files";
// Reuses the app's authenticated private Storage and account-scoped blob cache.
// Tests may override transport; production always uses these existing services.
export const MaterialImageServices = createContext({
  upload: uploadAttachment,
  url: attachmentUrl,
  blob: attachmentBlob,
});
