import { KirariCore } from './kiraricore.js';
import { sakuraScript,SakuraScriptBuilder } from "./sakurascriptbuilder.mjs";
import * as std from 'qjs:std';
import * as os from 'qjs:os';
import * as quickshiori from "quickshiori"
import { MediaSession } from "winrtmc.dll";
import {loadShioriEcho} from "./shioriEcho.js";
// import { initDivingFish } from "./diving-fish.js";


const ms = new MediaSession()
const app = new KirariCore({ protocol: 'SHIORI' });
ms.onChanged(()=>{return true})
// ── 在这里注册事件监听器 ──────────────────────────────────────────────────
function notifyHubMiddleware(ctx, next) {
	ctx.app.notifyHub = ctx.app.notifyHub || {}
	if (ctx.req.method == "NOTIFY") {
		ctx.app.notifyHub[ctx.req.headers["ID"]] = ctx.req.reference
	}
	ctx.notify = ctx.app.notifyHub
	next(ctx)
}
app.use(notifyHubMiddleware)


/**
 * 
 * @param {shioriContext} ctx 
 * @param {*} next 
 */
function HasEventMiddleWare(ctx, next) {
	if (ctx.app.config.hemwloaded == undefined) {
		ctx.app.config.hemwloaded = true
		ctx.app.get("Has_Event", (ctx) => {
			ctx.res.code = 200;
			let result = []
			for (const key in ctx.app.eventListener.GET) {
				result.push(key)
			}
			for (const key in ctx.app.eventListener.NOTIFY) {
				result.push(key)
			}
			if (result.findIndex(str => str == ctx.req.reference[0]) == -1) {
				ctx.res.headers["X-SSTP-PassThru-Result"] = "0"
			} else {
				ctx.res.headers["X-SSTP-PassThru-Result"] = "1"
			}
		})
		ctx.app.get("Get_Supported_Events", (ctx) => {
			ctx.res.code = 200;
			let result = []
			for (const key in ctx.app.eventListener.GET) {
				result.push(key)
			}
			for (const key in ctx.app.eventListener.NOTIFY) {
				result.push(key)
			}
			ctx.res.headers["X-SSTP-PassThru-local"] = result.join(",")
			ctx.res.headers["X-SSTP-PassThru-external"] = ""
		})
	}
	next(ctx)
}

app.use(HasEventMiddleWare)
    loadShioriEcho(app,{
		commandLog:true,
		commandLogPath: globalThis.__shiori_dir+ "/repl.log"
    })

// 初始化 Diving-Fish 中间件
// initDivingFish(app);
	
import { initMenu } from "./menu.js";
initMenu(app)

import { initFMOmw } from "./fmo.js";
initFMOmw(app)

import { initAnchor } from './anchor.js';
initAnchor(app)

// 其他事件监听器
app.get('OnBoot', (ctx) => {
    ctx.res.body = new SakuraScriptBuilder().scope(0).text("Hello, KirariCore!").end().toString();

});
app.get("OnSecondChange", (ctx) => {
    ms.poll()
    ctx.res.code = 204; // No Content
})
app.get("OnMouseClick", (ctx) => {
  if(ctx.req.reference[5] == 0){
    ctx.res.body = new SakuraScriptBuilder().raiseEvent("OnMenuOpen").toString()
  }
})

app.get("OnAboutView", (ctx) => {
    let body = new SakuraScriptBuilder().setQuickSection(true).scope(0).text("这是一个使用 ").anchor("QuickShiori","OnURLAnchorClick","https://github.com/cronfox/quickshiori").text(" 的 Ghost 示例。").newLine()
        .text(`QuickShiori版本:${quickshiori.process.versions.quickshiori}`).newLine()
        .text(`QuickJS-NG版本:${quickshiori.process.versions["quickjs-ng"]}`).newLine()
        .text(`使用Freeshell:`).anchor("https://himaoka.sakura.ne.jp/nanika_f3.htm","OnURLAnchorClick","https://himaoka.sakura.ne.jp/nanika_f3.htm").newLine()
        .end();
})


globalThis.__shiori_load = function (dirPath) {
    return true;
};
globalThis.__shiori_request = function (rawRequest) {
    let res = app.dispatch(rawRequest);
	return res;
};

globalThis.__shiori_unload = function () {
    return true;
};


// 初始化完成
console.log("index.js 加载完成");
