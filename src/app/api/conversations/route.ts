import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { listNatalThreads, listTransitThreads } from "@/server/horoscope/thread-service";
import { createConversation } from "@/server/horoscope/message-service";

const listQuerySchema = z.object({
  mode: z.enum(["TRANSIT", "NATAL"]).optional(),
});

const createSchema = z.object({
  categorySlug: z.string().min(1),
  mode: z.enum(["NATAL", "TRANSIT"]).optional(),
  transitDate: z.string().optional(),
  transitTime: z.string().optional(),
  transitCountry: z.string().optional(),
  transitProvince: z.string().optional(),
  transitDistrict: z.string().optional(),
});

/** Sidebar threads — TRANSIT by default; NATAL lists natal conversation threads. */
export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const { mode } = listQuerySchema.parse({
      mode: url.searchParams.get("mode") ?? undefined,
    });

    if (mode === "NATAL") {
      return ok(await listNatalThreads(user.id));
    }

    return ok(await listTransitThreads(user.id));
  });
}

/** Create a new conversation thread (natal or transit). */
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await req.json());
    const conversation = await createConversation({
      userId: user.id,
      ...body,
    });
    return ok(conversation);
  });
}
