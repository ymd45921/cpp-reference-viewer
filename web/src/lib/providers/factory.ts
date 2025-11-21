import type { Provider } from "./types";
import { RUNTIME_MODE } from "@/lib/config";
import { createFsProvider } from "./fs";
import { createStaticProvider } from "./static";
import { logger } from "@/lib/logger";

let fsProvider: Provider | null = null;

export function getProvider(origin?: string): Provider {
  if (RUNTIME_MODE === "serverless") {
    if (!origin) throw new Error("origin required for serverless provider");
    logger.debug({ origin }, "provider: serverless");
    return createStaticProvider(origin);
  }
  if (!fsProvider) {
    logger.debug("provider: server");
    fsProvider = createFsProvider();
  }
  return fsProvider;
}