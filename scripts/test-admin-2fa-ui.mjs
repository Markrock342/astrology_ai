import assert from "node:assert/strict";
import path from "node:path";
import {mkdir} from "node:fs/promises";
import {startAdminUiHarness} from "./lib/admin-ui-harness.mjs";
const artifacts=path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR??"output/admin-ui-tests");await mkdir(artifacts,{recursive:true});
const harness=await startAdminUiHarness({mockNavigation:true,
  imports:`import Verify from '${path.join(process.cwd(),"src/app/(admin-2fa)/admin-2fa/verify/page")}';import Setup from '${path.join(process.cwd(),"src/app/(admin-2fa)/admin-2fa/setup/page")}';import {Admin2faDeviceControl} from '${path.join(process.cwd(),"src/components/admin/admin-2fa-device-control")}';`,
  render:'window.location.pathname==="/setup"?<Setup/>:<><Verify/><div className="mx-auto max-w-md px-6 pb-6"><Admin2faDeviceControl/></div></>'});
const {page}=harness,requests=[];let reject=false;
try{
  await page.route("**/api/admin/2fa",async route=>{
    if(route.request().method()==="GET")return route.fulfill({json:{ok:true,data:{enrolled:false}}});
    const body=route.request().postDataJSON();requests.push(body);
    await route.fulfill({status:reject?422:200,json:reject?{ok:false,error:{message:"รหัส 2FA ไม่ถูกต้อง"}}:{ok:true,data:{verified:true,forgotten:true,qrDataUrl:"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",secretBase32:"TEST-ONLY-NOT-A-REAL-SECRET",backupCodes:["test-only-code"]}}});
  });
  const open=async()=>{await page.goto(harness.origin);await page.getByRole("heading",{name:"ยืนยัน Admin 2FA"}).waitFor();await page.evaluate(()=>document.fonts.ready)};
  const remembered=()=>page.getByRole("checkbox",{name:/จดจำอุปกรณ์นี้ 30 วัน/});
  const otp=()=>page.getByLabel("รหัส 6 หลัก",{exact:true});
  await open();assert.equal(await remembered().isChecked(),false);
  await otp().fill("123456");await page.waitForFunction(()=>window.__adminTestNavigation.includes("/admin"));
  assert.deepEqual(requests.at(-1),{action:"verify",code:"123456",rememberDevice:false});
  console.log("PASS 2FA default opt-out and six-digit auto-submit");
  await open();await remembered().check();
  await page.locator("main").screenshot({path:path.join(artifacts,"2fa-remember-30-days.png")});
  await otp().fill("654321");await page.waitForFunction(()=>window.__adminTestNavigation.includes("/admin"));
  assert.deepEqual(requests.at(-1),{action:"verify",code:"654321",rememberDevice:true});
  console.log("PASS 2FA explicit 30-day consent reaches verification API");
  reject=true;await open();await remembered().check();await otp().fill("123456");
  await page.getByRole("alert").filter({hasText:"รหัส 2FA ไม่ถูกต้อง"}).waitFor();
  assert.equal(await otp().inputValue(),"");assert.deepEqual(await page.evaluate(()=>window.__adminTestNavigation),[]);
  console.log("PASS wrong OTP never navigates to admin");
  reject=false;await page.getByRole("button",{name:"ใช้รหัสสำรองแทน",exact:true}).click();
  await page.getByLabel("รหัสสำรอง",{exact:true}).fill("deadbeef");await page.getByRole("button",{name:"ยืนยัน",exact:true}).click();
  await page.waitForFunction(()=>window.__adminTestNavigation.includes("/admin"));
  assert.deepEqual(requests.at(-1),{action:"verify",code:"deadbeef",rememberDevice:true});
  console.log("PASS backup code supports explicit device consent");
  await open();const before=requests.length;
  await page.getByRole("button",{name:"ลืมอุปกรณ์ 2FA",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"ยกเลิก",exact:true}).click();assert.equal(requests.length,before);
  await page.getByRole("button",{name:"ลืมอุปกรณ์ 2FA",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"ลืมอุปกรณ์นี้",exact:true}).click();
  await page.waitForFunction(()=>window.__adminTestNavigation.includes("/admin-2fa/verify"));
  assert.deepEqual(requests.at(-1),{action:"forget"});assert.deepEqual(harness.errors,[]);
  console.log("PASS forgetting requires confirmation and returns to 2FA; no browser errors");
  await page.goto(harness.origin+"/setup");
  await page.getByText("หรือใส่รหัสด้วยมือ:",{exact:false}).waitFor();
  assert.equal(await remembered().isChecked(),false);await remembered().check();
  await page.getByLabel("รหัสจากแอป",{exact:true}).fill("123456");
  await page.getByRole("button",{name:"ยืนยันและเปิด 2FA",exact:true}).click();
  await page.getByText("บันทึกรหัสสำรองไว้ในที่ปลอดภัย (ใช้ได้ครั้งเดียวต่อรหัส)",{exact:true}).waitFor();
  assert.deepEqual(requests.at(-1),{action:"confirm",code:"123456",rememberDevice:true});
  assert.deepEqual(harness.errors,[]);
  console.log("PASS initial enrollment passes explicit device consent");
}catch(e){await page.screenshot({path:path.join(artifacts,"2fa-failure.png"),fullPage:true}).catch(()=>{});throw e}
finally{await harness.close()}
