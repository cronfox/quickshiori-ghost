import * as esbuild from "esbuild";

await esbuild.build({
    entryPoints: ["src/main.js"],
    outfile: "dist/index.js",
    bundle: true,
    format: "esm",
    platform: "browser",
    minify: false,
    target: "es2020",
    external: [
        "qjs:*",
        "ukadll.dll",
        "ukafmo.dll",
        "winrtmc.dll",
        "quickshiori"
    ]
});
