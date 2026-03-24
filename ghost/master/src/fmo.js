import * as fmo from "ukafmo.dll"
import { SakuraScriptBuilder } from "./sakurascriptbuilder.mjs";
/**
 * @param {import('./kiraricore.js').KirariCore} app 
 */
export function initFMOmw(app){
    app.get("FMO.OnReadFMORaw", (ctx)=>{
        let fmoData = fmo.readFMORaw()
        if(fmoData == null){
            ctx.res.code = 404
        }
        fmoData = fmoData.split("\r\n").map(l => l.split("\x01").join("[\\x01]"))
        ctx.res.body = (new SakuraScriptBuilder()).setQuickSection(true).scope(0).text("原始FMO数据：").percentLine("200").rawScript(fmoData.reduce((acc, cur) => {
            return acc.text(cur).newLine()
        }, (new SakuraScriptBuilder()))).end().toString()
        ctx.res.code = 200
    })
    app.get("FMO.OnReadFMO", (ctx)=>{
        let fmoData = fmo.readFMO()
        let body = new SakuraScriptBuilder().setQuickSection(true).scope(0).text(`当前有${fmoData.length}个Ghost在运行，请选择：`).percentLine(200)
        fmoData.forEach(e=>{
            body.scriptChoice(`${e.name}`, Object.entries(e).filter(kv=>kv[0]!="id").map(kv=>`${kv[0]}=${kv[1]}`).reduce((a,c)=>a.text(c).newLine(), new SakuraScriptBuilder().setQuickSection(true))).newLine()
        })
        ctx.res.body = body.end().toString()
        ctx.res.code = 200
    })
}