// Real Chromium + real React editor; only the HTTP boundary is stubbed.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { startAdminUiHarness } from "./lib/admin-ui-harness.mjs";
const root=process.cwd();
const artifacts=path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR??path.join(root,"output/admin-ui-tests"));
await mkdir(artifacts,{recursive:true});
const harness=await startAdminUiHarness({
  imports:`import {StrictMode} from 'react';import {UserExpiryEditor} from '${path.join(root,"src/components/admin/user-expiry-editor")}';`,
  render:'<StrictMode><main className="mx-auto max-w-2xl p-6"><UserExpiryEditor userId="test-only" onSaved={async()=>{}}/></main></StrictMode>',
});
const {page,errors}=harness;
try {
  let expiresAt=null, canEdit=true, fail=false;
  let getCount=0, releaseOld;
  const oldResponse=new Promise(resolve=>{releaseOld=resolve});
  const writes=[];
  const futureDay=new Date(Date.now()+7*86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});
  await page.route("**/api/admin/users/test-only/expiry", async route=>{
    if(route.request().method()==="GET"&&++getCount===1){
      await oldResponse;
      return route.fulfill({json:{ok:true,data:{revision:"a".repeat(64),canEdit:true,expiresAt:null,scope:"FREE"}}});
    }
    if(route.request().method()==="PATCH"){
      const body=route.request().postDataJSON();writes.push(body);
      if(fail)return route.fulfill({status:400,json:{ok:false,error:{message:"ข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดวันหมดอายุใหม่ก่อนบันทึก"}}});
      expiresAt=body.expiresAt;
    }
    await route.fulfill({json:{ok:true,data:{revision:"a".repeat(64),canEdit,expiresAt,scope:"FREE"}}});
  });
  const open=async()=>{await page.goto(harness.origin);await page.getByText("ปัจจุบัน:",{exact:false}).waitFor();await page.getByRole("button",{name:"โหลดวันหมดอายุใหม่"}).click();await page.waitForFunction(()=>!document.body.textContent.includes("กำลังโหลด…"));};
  const save=()=>page.getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true});
  const reason=()=>page.getByRole("textbox",{name:"เหตุผลการแก้วันหมดอายุ",exact:true});
  const submit=async()=>{await save().click();};
  const confirm=async()=>{await page.getByRole("dialog").getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();};
  await open();
  await page.evaluate(()=>document.fonts.ready);
  await page.getByLabel("ระยะเวลาใช้งานรายคน").selectOption("date");
  await page.getByLabel("วันหมดอายุใหม่",{exact:true}).fill(futureDay);
  const delayedResponse=page.waitForResponse(r=>r.url().endsWith("/expiry")&&r.request().method()==="GET");
  releaseOld();await delayedResponse;
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.getByLabel("ระยะเวลาใช้งานรายคน").inputValue(),"date");
  console.log("PASS a delayed stale load cannot overwrite the selected Free expiry mode");
  assert.equal(await save().isEnabled(),true);
  for(const value of ["","ab","   "]){
    await reason().fill(value);await submit();
    await page.getByRole("alert").filter({hasText:"3–300"}).waitFor();
    assert.equal(await reason().evaluate(el=>el===document.activeElement),true);
    assert.equal(writes.length,0);
    if(value==="")await page.locator("main").screenshot({path:path.join(artifacts,"reason-required.png")});
  }
  console.log("PASS empty/short/whitespace reasons give visible feedback, focus field, and send no request");
  await page.getByLabel("ระยะเวลาใช้งานรายคน").selectOption("date");
  await reason().fill("กำหนดวันสิ้นสุดบัญชีทดลองใช้");
  for(const value of ["","2020-01-01"]){
    await page.getByLabel("วันหมดอายุใหม่",{exact:true}).fill(value);await submit();
    await page.getByRole("alert").filter({hasText:"วันนี้หรือวันในอนาคต"}).waitFor();
    assert.equal(writes.length,0);
  }
  console.log("PASS missing/past dates blocked before confirmation");
  await page.getByLabel("วันหมดอายุใหม่",{exact:true}).fill(futureDay);
  await submit();await page.getByRole("dialog").getByRole("button",{name:"ยกเลิก",exact:true}).click();
  assert.equal(writes.length,0);
  await submit();await confirm();await page.getByRole("status").waitFor();
  await page.locator("main").screenshot({path:path.join(artifacts,"dated-saved.png")});
  assert.equal(writes.at(-1).expiresAt,`${futureDay}T16:59:59.000Z`);
  assert.equal(await page.getByLabel("วันหมดอายุใหม่",{exact:true}).inputValue(),futureDay);
  await page.reload();await page.getByLabel("วันหมดอายุใหม่",{exact:true}).waitFor();
  assert.equal(await page.getByLabel("วันหมดอายุใหม่",{exact:true}).inputValue(),futureDay);
  console.log("PASS cancel sends nothing; dated save uses Bangkok end-of-day and reloads saved date");
  await page.getByLabel("ระยะเวลาใช้งานรายคน").selectOption("forever");
  await reason().fill("  ไม่มีวันหมดอายุ  ");await submit();await confirm();await page.getByRole("status").waitFor();
  await page.locator("main").screenshot({path:path.join(artifacts,"forever-saved.png")});
  assert.equal(writes.at(-1).expiresAt,null);assert.equal(writes.at(-1).reason,"ไม่มีวันหมดอายุ");
  await page.reload();await page.getByText("ปัจจุบัน: ไม่มีวันหมดอายุ",{exact:true}).waitFor();
  console.log("PASS indefinite expiry saves null and survives reload");
  fail=true;await reason().fill("ทดสอบข้อมูลเปลี่ยน");await submit();await confirm();
  await page.getByRole("alert").filter({hasText:"ข้อมูลผู้ใช้เปลี่ยนแล้ว"}).waitFor();
  assert.equal(await page.getByRole("status").count(),0);
  console.log("PASS stale revision error remains visible, no false success");
  canEdit=false;await page.reload();await page.getByText("ไม่สามารถแก้วันหมดอายุได้ กรุณาโหลดข้อมูลใหม่").waitFor();
  assert.equal(await save().isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log("PASS ineligible account stays disabled; no browser errors");
  await page.screenshot({path:path.join(artifacts,"ineligible.png"),fullPage:true});
} catch(error) {
  if(page&&!page.isClosed())await page.screenshot({path:path.join(artifacts,"failure.png"),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await harness.close();
}
