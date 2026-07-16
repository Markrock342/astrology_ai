import { prisma } from "@/server/db";

/**
 * GET /api/media/:id — publicly serve a CMS image stored in media_assets.
 * Cacheable; no auth (URLs are unguessable cuids).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    if (!id || id.length > 64) {
      return new Response("Not found", { status: 404 });
    }

    const row = await prisma.mediaAsset.findUnique({
      where: { id },
      select: { contentType: true, bytes: true },
    });
    if (!row) {
      return new Response("Not found", { status: 404 });
    }

    const body = Buffer.from(row.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
