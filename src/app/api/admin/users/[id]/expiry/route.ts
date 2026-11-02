import {handle,ok} from "@/lib/http";
import {requireAdmin} from "@/server/auth/rbac";
import {clientIp} from "@/lib/rate-limit";
import {getUserExpiry,setUserExpiry,userExpirySchema} from "@/server/admin/user-expiry-service";
type Context={params:Promise<{id:string}>};
export async function GET(_req:Request,ctx:Context){return handle(async()=>{await requireAdmin();return ok(await getUserExpiry((await ctx.params).id));});}
export async function PATCH(req:Request,ctx:Context){return handle(async()=>{const actor=await requireAdmin();const input=userExpirySchema.parse(await req.json());return ok(await setUserExpiry((await ctx.params).id,input,{id:actor.id,ip:clientIp(req)}));});}
