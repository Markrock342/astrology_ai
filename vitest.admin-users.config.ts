import { defineConfig } from "vitest/config";
import base from "./vitest.config";

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ["tests/integration/admin-user-packages.integration.ts","tests/integration/admin-2fa-device.integration.ts","tests/integration/free-expiry.integration.ts","tests/integration/free-signup-default.integration.ts"],
    fileParallelism: false,
  },
});
