import {mkdtemp,writeFile,mkdir,rm} from "node:fs/promises";
import {existsSync} from "node:fs";
import {createServer} from "node:http";
import path from "node:path";
import {build} from "vite";
import {chromium} from "playwright";

/** Real components + repository CSS. Only navigation/HTTP are test boundaries. */
export async function startAdminUiHarness({imports,render,mockNavigation=false}){
  const root=process.cwd();await mkdir(path.join(root,"tmp"),{recursive:true});
  const temp=await mkdtemp(path.join(root,"tmp/admin-ui-harness-"));
  let server,browser;
  const close=async()=>{
    await browser?.close();
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
    await rm(temp,{recursive:true,force:true});
  };
  try{
    const entry=path.join(temp,"entry.tsx"),router=path.join(temp,"router.mjs");
    await writeFile(router,`const router={replace:(url)=>window.__adminTestNavigation.push(url),refresh:()=>window.__adminTestNavigation.push('refresh')};export function usePathname(){return '/admin'};export function useRouter(){return router};`);
    await writeFile(entry,`import {createRoot} from 'react-dom/client';import '@fontsource-variable/noto-sans-thai';import '${path.join(root,"src/app/globals.css")}';${imports}\nObject.assign(window,{__adminTestNavigation:[]});createRoot(document.getElementById('root')!).render(${render});`);
    const result=await build({configFile:false,logLevel:"error",root,resolve:{alias:{"@":path.join(root,"src"),...(mockNavigation?{"next/navigation":router}:{})}},
      esbuild:{jsx:"automatic",jsxDev:false},define:{"process.env.NODE_ENV":'"development"',"process.env":"{}"},
      build:{write:false,minify:false,lib:{entry,formats:["iife"],name:"AdminUITest"}}});
    const output=(Array.isArray(result)?result[0]:result).output;
    const js=output.find(o=>o.type==="chunk").code;
    const css=output.filter(o=>o.type==="asset"&&o.fileName.endsWith(".css")).map(o=>String(o.source)).join("\n");
    server=createServer((req,res)=>{
      res.setHeader("Content-Type",req.url==="/app.js"?"text/javascript":req.url==="/style.css"?"text/css":"text/html; charset=utf-8");
      res.end(req.url==="/app.js"?js:req.url==="/style.css"?css:'<!doctype html><html lang="th" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
    });
    await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
    const executablePath=process.env.PLAYWRIGHT_EXECUTABLE_PATH??(!existsSync(chromium.executablePath())&&existsSync("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")?"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser":undefined);
    browser=await chromium.launch({executablePath,timeout:20000});
    const page=await browser.newPage({viewport:{width:900,height:850},locale:"th-TH"});
    page.setDefaultTimeout(15000);
    const errors=[];page.on("pageerror",e=>{errors.push(e.message);console.error("Browser error:",e.message)});
    return {page,errors,origin:`http://127.0.0.1:${server.address().port}`,close};
  }catch(e){await close();throw e}
}
