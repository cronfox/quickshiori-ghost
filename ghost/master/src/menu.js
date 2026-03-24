//菜单系统
import { SakuraScriptBuilder } from "./sakurascriptbuilder.mjs"
import * as quickshiori from "quickshiori"

const menu = {
    "/": {
        title: "主菜单",
        type: "directory",
        entries: [
            {
                title: "实用工具", type: "path", path: "/utils"
            },
            {
                title: "关于", type: "path", path: "/about"
            }
        ]
    },
    "/about": {
        title: "关于",
        type: "static",
        content: new SakuraScriptBuilder().setQuickSection(true).scope(0).text("这是一个使用 ").anchor("QuickShiori", "OnURLAnchorClick", "https://github.com/cronfox/quickshiori").text(" 的 Ghost 示例。").newLine()
            .text(`QuickShiori版本:${quickshiori.process.versions.quickshiori}`).newLine()
            .text(`QuickJS-NG版本:${quickshiori.process.versions["quickjs-ng"]}`).newLine()
            .text(`使用Freeshell:`).anchor("https://himaoka.sakura.ne.jp/nanika_f3.htm", "OnURLAnchorClick", "https://himaoka.sakura.ne.jp/nanika_f3.htm").newLine()
            
    },
    "/utils": {
        title: "实用工具",
        type: "directory",
        entries: [
            {
                title: "现在播放了什么", type: "event", event: "OnRTMCPlaying"
            },
            {
                title: "读取FMO", type: "path", path: "/utils/fmo"
            }
        ]
    },
    "/utils/fmo": {
        title: "FMO Reader",
        type: "directory",
        entries: [
            {
                title: "读取FMO（原始）", type: "event", event: "FMO.OnReadFMORaw"
            },
            {
                title: "读取FMO（解析）", type: "event", event: "FMO.OnReadFMO"
            }
        ]
    }
}
/**
 * 
 * @param {import("./kiraricore.js").KirariCore} app 
 */
export function initMenu(app) {
    app.get("OnMenuOpen", (ctx) => {
        const path = ctx.req.reference[0] || "/"
        const menuNode = menu[path]
        if (menuNode) {
            let body = new SakuraScriptBuilder().executeBangCommand("lock","balloonrepaint").setQuickSection(true).scope(0).text(menuNode.title).percentLine("200")
            if (menuNode.type == "directory") {
                ctx.res.code = 200;
                menuNode.entries.forEach(entry => {
                    if (entry.type == "path") {
                        body = body.choice(entry.title, "OnMenuOpen", entry.path).newLine()
                    } else if (entry.type == "event") {
                        body = body.scriptChoice(entry.title, new SakuraScriptBuilder().raiseEvent(entry.event)).newLine()
                    }
                })
            }
            else if (menuNode.type == "static") {
                ctx.res.code = 200;
                body = body.rawScript(menuNode.content).newLine()
            }
            body = body.locate("0", "@2lh")
            if (path != "/") {
                body = body.choice("返回上一级", "OnMenuOpen", path.split("/").slice(0, -1).join("/") || "/").newLine()
            }
            body = body.scriptChoice("关闭菜单", "\\e").newLine().timerRaise(15000, false, "OnMenuOpenTimeout")
            ctx.res.body = body.executeBangCommand("unlock","balloonrepaint").end().toString()
        }
    })
    app.get("OnMenuOpenTimeout", (ctx) => {
        ctx.res.body = new SakuraScriptBuilder().end()
    })
}