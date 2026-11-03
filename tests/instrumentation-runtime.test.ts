import {afterEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({start:vi.fn()}));
vi.mock("@/server/internal-scheduler",()=>({startInternalScheduler:m.start}));
import {register} from "@/instrumentation";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()});
describe("runtime-specific scheduler instrumentation",()=>{
  for(const [runtime,mode,scheduler,expected] of [["edge","production","on",false],["nodejs","development","on",false],["nodejs","production","off",false],["nodejs","production","on",true]] as const){
    it(`${runtime}/${mode}/${scheduler} starts=${expected}`,async()=>{
      vi.stubEnv("NEXT_RUNTIME",runtime);vi.stubEnv("NODE_ENV",mode);vi.stubEnv("INTERNAL_SCHEDULER",scheduler);
      await register();expect(m.start).toHaveBeenCalledTimes(expected?1:0);
    });
  }
});
