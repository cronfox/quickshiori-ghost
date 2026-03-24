import { SakuraScriptBuilder } from "./sakurascriptbuilder.mjs";
/**
 * @param {import('./kiraricore.js').KirariCore} app 
 */
export function initAnchor(app){
    app.get("OnURLAnchorClick", (ctx)=>{
        let [url,text] = ctx.req.reference
        text = text || ""
        ctx.res.body = (new SakuraScriptBuilder()).text(text).openBrowser(url)
    })
}