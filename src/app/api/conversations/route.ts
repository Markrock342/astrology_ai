import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireUser } from "@/server/auth/rbac";
import { listUserThreads } from "@/server/horoscope/thread-service";
import { createConversation } from "@/server/horoscope/message-service";

const createSchema = z.object({
  categorySlug: z.string().min(1),
  mode: z.enum(["NATAL", "TRANSIT"]).optional(),
  transitDate: z.string().optional(),
  transitTime: z.string().optional(),
  transitCountry: z.string().optional(),
  transitProvince: z.string().optional(),
  transitDistrict: z.string().optional(),
});

/** Chat history threads (derived from past readings until full chat model ships). */
export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return ok(await listUserThreads(user.id));
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
