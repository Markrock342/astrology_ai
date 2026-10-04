import { cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/server/cms/preview-constants";
import { isValidPreviewToken } from "@/server/cms/preview-token";

/** True when admin enabled CMS preview mode (cookie). */
export async function isPreviewMode(): Promise<boolean> {
  const jar = await cookies();
  return isValidPreviewToken(jar.get(PREVIEW_COOKIE)?.value);
}
