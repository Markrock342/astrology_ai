// Real Chromium + real React editor; only the HTTP boundary is stubbed.
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { build } from "vite";
import { chromium } from "playwright";
import { existsSync } from "node:fs";

const root = process.cwd();
const artifacts=path.resolve(process.env.ADMIN_UI_ARTIFACT_DIR??path.join(root,"output/admin-ui-tests"));
await mkdir(artifacts,{recursive:true});
await mkdir(path.join(root,"tmp"),{recursive:true});
const temp = await mkdtemp(path.join(root, "tmp/expiry-ui-"));
let server, browser, page;
try {
  const entry = path.join(temp, "entry.tsx");
  await writeFile(entry, `import {createRoot} from 'react-dom/client';
import '@fontsource-variable/noto-sans-thai';
import '${path.join(root,"src/app/globals.css")}';
import {UserExpiryEditor} from '${path.join(root, "src/components/admin/user-expiry-editor")}';
createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-2xl p-6"><UserExpiryEditor userId="test-only" onSaved={async()=>{}}/></main>);`);
  const bundle = await build({
    configFile: false, logLevel: "error", root,
    resolve: { alias: { "@": path.join(root, "src") } },
    esbuild: { jsx: "automatic", jsxDev: false },
    define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
    build: { write: false, minify: false, lib: { entry, formats: ["iife"], name: "ExpiryUI" } },
  });
  const output=(Array.isArray(bundle) ? bundle[0] : bundle).output;
  const js=output.find(o=>o.type==="chunk").code;
  const css=output.filter(o=>o.type==="asset"&&o.fileName.endsWith(".css")).map(o=>String(o.source)).join("\n");
  console.log("Harness bundled");
  server = createServer((req,res)=>{
    res.setHeader("Content-Type", req.url==="/app.js" ? "text/javascript" : req.url==="/style.css"?"text/css":"text/html; charset=utf-8");
    res.end(req.url==="/app.js" ? js : req.url==="/style.css"?css:'<!doctype html><html lang="th" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  const installedBrowser=process.env.PLAYWRIGHT_EXECUTABLE_PATH??(!existsSync(chromium.executablePath())&&existsSync("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")?"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser":undefined);
  browser = await chromium.launch({executablePath:installedBrowser,timeout:20000});
  console.log("Browser launched");
  page = await browser.newPage({viewport:{width:900,height:850},locale:"th-TH"});
  page.setDefaultTimeout(15000);
  const errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error("Browser error:",e.message)});
  let expiresAt=null, canEdit=true, fail=false;
  const writes=[];
  const futureDay=new Date(Date.now()+7*86400000).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});
  await page.route("**/api/admin/users/test-only/expiry", async route=>{
    if(route.request().method()==="PATCH"){
      const body=route.request().postDataJSON();writes.push(body);
      if(fail)return route.fulfill({status:400,json:{ok:false,error:{message:"ข้อมูลผู้ใช้เปลี่ยนแล้ว กรุณาโหลดวันหมดอายุใหม่ก่อนบันทึก"}}});
      expiresAt=body.expiresAt;
    }
    await route.fulfill({json:{ok:true,data:{revision:"a".repeat(64),canEdit,expiresAt}}});
  });
  const open=async()=>{await page.goto(`http://127.0.0.1:${server.address().port}`);await page.getByText("ปัจจุบัน:",{exact:false}).waitFor();await page.getByRole("button",{name:"โหลดวันหมดอายุใหม่"}).click();await page.waitForFunction(()=>!document.body.textContent.includes("กำลังโหลด…"));};
  const save=()=>page.getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true});
  const reason=()=>page.getByRole("textbox",{name:"เหตุผลการแก้วันหมดอายุ",exact:true});
  const submit=async()=>{await save().click();};
  const confirm=async()=>{await page.getByRole("dialog").getByRole("button",{name:"บันทึกวันหมดอายุ",exact:true}).click();};
  await open();
  await page.evaluate(()=>document.fonts.ready);
  await page.getByLabel("ระยะเวลาใช้งานรายคน").selectOption("date");
  await page.getByLabel("วันหมดอายุใหม่",{exact:true}).fill(futureDay);
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
  canEdit=false;await page.reload();await page.getByText("บัญชีนี้ไม่มีสิทธิ์สมาชิกหรือคำถามที่ซื้อ/ให้ไว้ให้แก้วันหมดอายุ").waitFor();
  assert.equal(await save().isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log("PASS ineligible account stays disabled; no browser errors");
  await page.screenshot({path:path.join(artifacts,"ineligible.png"),fullPage:true});
} catch(error) {
  if(page&&!page.isClosed())await page.screenshot({path:path.join(artifacts,"failure.png"),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await browser?.close();
  if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
  await rm(temp,{recursive:true,force:true});
}
