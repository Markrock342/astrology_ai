// Full Next.js page + actual authenticated API + isolated PostgreSQL.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {createWriteStream,existsSync} from "node:fs";
import {mkdir,readFile,writeFile,rm} from "node:fs/promises";
import {setTimeout as delay} from "node:timers/promises";
import path from "node:path";
import {PrismaClient} from "@prisma/client";
import {encode} from "next-auth/jwt";
import {chromium,expect} from "@playwright/test";
import {issueAdmin2faToken} from "../src/server/auth/admin-2fa-token.ts";
import {sourceFingerprint} from "./source-fingerprint.mjs";
const raw=process.env.DATABASE_URL??"",url=new URL(raw||"postgresql://invalid/invalid");
if(!["127.0.0.1","localhost"].includes(url.hostname)||!/^\/hora_admin_filter_test(?:_[a-zA-Z0-9_-]+)?$/.test(url.pathname)||[...url.searchParams.keys()].some(k=>!["schema","connection_limit","pool_timeout"].includes(k)))throw new Error("Refusing E2E outside isolated local hora_admin_filter_test DB");
const db=new PrismaClient({datasources:{db:{url:raw}}}),prefix=`free-expiry-ui-${Date.now()}-`,adminId=prefix+"admin";
const ids=[prefix+"free-only",prefix+"free-zero"],secret="local-free-expiry-e2e-only-not-production";
const artifacts=path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR??"output/admin-ui-tests");await mkdir(artifacts,{recursive:true});
const log=createWriteStream(path.join(artifacts,"free-expiry-next-server.log"),{mode:0o600});
const agentsBefore=await readFile("AGENTS.md","utf8").catch(()=>null);
let child,browser,activePage;
try{
  const free=await db.package.upsert({where:{code:"FREE"},create:{code:"FREE",name:"Free",type:"FREE",usageBudgetUnits:75000},update:{}});
  const admin=await db.user.create({data:{id:adminId,email:`${adminId}@example.invalid`,name:"Regression Admin",role:"ADMIN",status:"ACTIVE",totpSecretEnc:"local-fixture-2fa-only",totpEnabledAt:new Date()}});
  for(const [index,id] of ids.entries())await db.user.create({data:{id,email:`${id}@example.invalid`,name:index?"Free Zero Balance Test":"Free Only Test",subscriptions:{create:{packageId:free.id,status:"ACTIVE"}},usageWallet:{create:{includedBalanceUnits:index?0:30000,includedAllowanceUnits:75000,purchasedBalanceUnits:0}}}});
  const portServer=createServer();await new Promise(resolve=>portServer.listen(0,"127.0.0.1",resolve));
  const port=portServer.address().port;await new Promise(resolve=>portServer.close(resolve));const origin=`http://127.0.0.1:${port}`;
  const production=process.env.CI==="true"||process.env.FREE_EXPIRY_E2E_PRODUCTION==="1";
  const reuseBuild=production&&process.env.CI!=="true"&&process.env.FREE_EXPIRY_E2E_REUSE_BUILD==="1";
  const env={...process.env,NODE_ENV:production?"production":"development",DATABASE_URL:raw,DIRECT_URL:raw,AUTH_SECRET:secret,AUTH_URL:origin,NEXTAUTH_URL:origin,AUTH_TRUST_HOST:"true",NEXT_TELEMETRY_DISABLED:"1",UPSTASH_REDIS_REST_URL:"https://redis-disabled.invalid",UPSTASH_REDIS_REST_TOKEN:"",AUTH_RATELIMIT_STRICT:"false",TURNSTILE_SECRET_KEY:"",AUTH_GOOGLE_ID:"",AUTH_GOOGLE_SECRET:"",RESEND_API_KEY:"",GEMINI_API_KEY:"",OPENAI_API_KEY:"",AI_SECRET_ENC_KEY:"",INTERNAL_SCHEDULER:"off"};
  if(existsSync(".next/dev/lock")||existsSync(".next/lock"))throw new Error("Stop the existing Next dev/build process before this isolated E2E run");
  // A killed dev compilation can leave partial JSON manifests on external
  // macOS volumes. Start with fresh generated dev output, never source files.
  if(production&&!reuseBuild){
    // CI must exercise the production bundle: dev Fast Refresh can replace the
    // document mid-assertion after type/manifest generation and hide controls.
    console.log("Building the actual production bundle for isolated Free E2E");
    // Linux CI uses the deployed Turbopack build. Local external macOS volumes
    // can corrupt Turbopack's persistence DB; webpack still builds real prod.
    child=spawn(process.execPath,["node_modules/next/dist/bin/next","build",...(process.env.CI==="true"?[]:["--webpack"])],{env,detached:true,stdio:["ignore","pipe","pipe"]});
    child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
    await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",code=>code===0?resolve():reject(new Error("Isolated production build failed; see server log")))});
    child=undefined;
  }else if(!production)await rm(".next/dev",{recursive:true,force:true});
  child=spawn(process.execPath,["node_modules/next/dist/bin/next",...(production?["start"]:["dev","--webpack"]),"--hostname","127.0.0.1","--port",String(port)],{env,detached:true,stdio:["ignore","pipe","pipe"]});
  child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
  let ready=false;const deadline=Date.now()+180000;
  while(Date.now()<deadline){
    if(child.exitCode!==null)throw new Error("Next test server exited; see local server log");
    try{const r=await fetch(origin+"/api/version",{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break}}catch{}
    await delay(500);
  }
  assert.equal(ready,true,"Next dev test server must become ready");
  if(reuseBuild){const version=await fetch(origin+"/api/version").then(r=>r.json());assert.equal(version.source,sourceFingerprint(),"Refusing stale production bundle; rebuild before E2E")}
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH});
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:"th-TH"});
  const sessionName="authjs.session-token";
  const session=await encode({token:{sub:adminId,role:"ADMIN",status:"ACTIVE",name:admin.name,email:admin.email},secret,salt:sessionName,maxAge:3600});
  const proof=issueAdmin2faToken(admin,"session",secret);
  await context.addCookies([{name:sessionName,value:session,url:origin,httpOnly:true,sameSite:"Lax"},{name:"horasard_admin_2fa",value:proof.value,url:origin,httpOnly:true,sameSite:"Lax"}]);
  const page=await context.newPage();activePage=page;page.setDefaultTimeout(60000);
  const futureDay=new Date(Date.now()+7*86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});
  for(const [index,id] of ids.entries()){
    const pageResponse=await page.goto(origin+`/admin/users/${id}`,{timeout:180000});
    assert.equal(pageResponse.status(),200,"Actual Next admin page must render successfully");
    const mode=page.getByLabel("ระยะเวลาใช้งานรายคน");await expect(mode).toBeEnabled({timeout:60000});
    await mode.selectOption("date");await page.getByLabel("วันหมดอายุใหม่",{exact:true}).fill(futureDay);
    await page.getByLabel("เหตุผลการแก้วันหมดอายุ",{exact:true}).fill("ทดสอบ Free โดยไม่เติมคำถาม");
    const response=page.waitForResponse(r=>r.url().endsWith(`/api/admin/users/${id}/expiry`)&&r.request().method()==="PATCH");
    await page.getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();
    await page.getByRole("dialog").getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();
    assert.equal((await response).status(),200);await page.getByRole("status").filter({hasText:"บันทึกวันหมดอายุแล้ว"}).waitFor();
    const w=await db.usageWallet.findUniqueOrThrow({where:{userId:id}});
    assert.equal(w.includedBalanceUnits,index?0:30000);assert.equal(w.purchasedBalanceUnits,0);
    assert.equal(w.periodEndsAt.toISOString(),`${futureDay}T16:59:59.000Z`);
    assert.equal(await db.userSubscription.count({where:{userId:id,package:{type:"PRO"}}}),0);
    assert.equal(await db.usageTransaction.count({where:{userId:id}}),0);
    if(index===0)await page.screenshot({path:path.join(artifacts,"free-only-real-next-saved.png"),fullPage:true});
    await page.reload();await expect(mode).toBeEnabled({timeout:60000});await expect(page.getByLabel("วันหมดอายุใหม่",{exact:true})).toHaveValue(futureDay);
    await mode.selectOption("forever");await page.getByLabel("เหตุผลการแก้วันหมดอายุ",{exact:true}).fill("ยกเลิกวันหมดอายุโดยไม่เติมคำถาม");
    await expect(mode).toHaveValue("forever");
    const indefinite=page.waitForResponse(r=>r.url().endsWith(`/api/admin/users/${id}/expiry`)&&r.request().method()==="PATCH");
    await page.getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("ไม่มีวันหมดอายุ");await page.getByRole("dialog").getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();
    const indefiniteResponse=await indefinite;assert.equal(indefiniteResponse.request().postDataJSON().expiresAt,null);
    assert.equal(indefiniteResponse.status(),200);await page.getByRole("status").filter({hasText:"บันทึกวันหมดอายุแล้ว"}).waitFor();
    assert.equal((await db.usageWallet.findUniqueOrThrow({where:{userId:id}})).periodEndsAt,null);
    console.log(`PASS real Next.js + authenticated API + PostgreSQL: Free ${index?"zero":"included-only"} date/null, reload, unchanged balances, no Pro/grants`);
  }
  const existingBefore=await db.usageWallet.findUniqueOrThrow({where:{userId:ids[0]}});
  const existingSub=await db.userSubscription.findFirstOrThrow({where:{userId:ids[0]}});
  await page.goto(origin+"/admin/packages",{timeout:180000});
  await page.getByRole("button",{name:"แก้ไข",exact:true}).first().click();
  await page.getByLabel(/^วันหมดอายุ Free สำหรับผู้สมัครใหม่/).selectOption("DAYS");
  await page.getByLabel("จำนวนวันหลังสมัคร").fill("30");
  const packageSave=page.waitForResponse(r=>r.url().endsWith(`/api/admin/packages/${free.id}`)&&r.request().method()==="PATCH");
  await page.getByRole("button",{name:"บันทึก",exact:true}).click();
  assert.equal((await packageSave).status(),200);
  const configured=await db.package.findUniqueOrThrow({where:{id:free.id}});
  assert.equal(configured.type,"FREE");assert.equal(configured.expiryMode,"DAYS");assert.equal(configured.expiryDays,30);assert.equal(configured.questionPack,false);
  assert.deepEqual(await db.usageWallet.findUniqueOrThrow({where:{userId:ids[0]}}),existingBefore);
  assert.deepEqual(await db.userSubscription.findUniqueOrThrow({where:{id:existingSub.id}}),existingSub);
  await page.screenshot({path:path.join(artifacts,"free-default-30-days-saved.png"),fullPage:true});
  const signupContext=await browser.newContext();
  const signup=await signupContext.request.post(origin+"/api/auth/register",{data:{email:prefix+"new-signup@example.invalid",password:"Local-signup-only-123456",acceptTerms:true}});
  assert.equal(signup.status(),201,"Real email registration API must succeed");
  const signupJson=await signup.json(),created=await db.user.findUniqueOrThrow({where:{id:signupJson.data.id}});
  const signupSub=await db.userSubscription.findFirstOrThrow({where:{userId:created.id,packageId:free.id}});
  const signupWallet=await db.usageWallet.findUniqueOrThrow({where:{userId:created.id}});
  assert.equal(signupSub.expiresAt.getTime(),created.createdAt.getTime()+30*86400000);
  assert.equal(signupWallet.periodEndsAt.getTime(),signupSub.expiresAt.getTime());
  assert.equal(signupWallet.purchasedBalanceUnits,0);assert.equal(await db.userSubscription.count({where:{userId:created.id,package:{type:"PRO"}}}),0);
  await signupContext.close();
  console.log("PASS real package UI saves Free 30 days; real registration API applies it; existing account dates/balances unchanged");
}catch(error){
  if(activePage&&!activePage.isClosed()){
    console.error("Free E2E failed at",activePage.url());
    await activePage.screenshot({path:path.join(artifacts,"free-expiry-e2e-failure.png"),fullPage:true}).catch(()=>{});
  }
  throw error;
}finally{
  await browser?.close();
  if(child&&child.exitCode===null&&!child.signalCode){
    const exited=new Promise(resolve=>child.once("exit",resolve));
    process.kill(-child.pid,"SIGTERM");await Promise.race([exited,delay(10000)]);
    if(child.exitCode===null&&!child.signalCode)process.kill(-child.pid,"SIGKILL");
  }
  log.end();
  // next dev updates its own AGENTS block. Restore only if no unrelated edit
  // happened while the test ran; preserve any concurrent user instructions.
  if(agentsBefore!==null){
    const current=await readFile("AGENTS.md","utf8").catch(()=>null);
    const withoutBlock=s=>s.replace(/<!-- BEGIN:nextjs-agent-rules -->[\s\S]*?<!-- END:nextjs-agent-rules -->/,"");
    if(current!==null&&withoutBlock(current)===withoutBlock(agentsBefore))await writeFile("AGENTS.md",agentsBefore);
  }
  await db.adminAuditLog.deleteMany({where:{adminUserId:adminId}});
  await db.user.deleteMany({where:{OR:[{id:{in:[adminId,...ids]}},{email:{startsWith:prefix}}]}});await db.$disconnect();
}
