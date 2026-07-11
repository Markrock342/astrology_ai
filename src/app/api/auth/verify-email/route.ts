import { handle, ok } from "@/lib/http";
import { verifyEmailSchema } from "@/lib/schemas";
import { verifyEmailToken } from "@/server/auth/email-verification-service";

export async function POST(req: Request) {
  return handle(async () => {
    const { token } = verifyEmailSchema.parse(await req.json());
    await verifyEmailToken(token);
    return ok({ verified: true });
  });
}
