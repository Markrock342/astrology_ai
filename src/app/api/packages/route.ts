import { handle, ok } from "@/lib/http";
import { listPublicPackages } from "@/server/admin/catalog-admin-service";

/** GET /api/packages — enabled packages for the account/plan comparison page. */
export async function GET() {
  return handle(async () => ok(await listPublicPackages()));
}
