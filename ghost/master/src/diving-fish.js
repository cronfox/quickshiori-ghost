/**
 * Diving-Fish API 中间件
 * 使用 ![execute,http-get,...] 实现查歌功能
 */

import { SakuraScriptBuilder } from "./sakurascriptbuilder.mjs";

// Diving-Fish API 端点
const MUSIC_DATA_URL = "https://www.diving-fish.com/api/maimaidxprober/music_data";

// 缓存配置
const CACHE_KEY = "diving_fish_music_data";
const CACHE_TIMESTAMP_KEY = "diving_fish_cache_time";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1天

// 输入框 ID
const INPUT_BOX_ID = "diving_fish_search";

// 存储待处理的搜索请求
let pendingSearch = null;

/**
 * 初始化 Diving-Fish 中间件
 * @param {import('./kiraricore.js').KirariCore} app
 */
export function initDivingFish(app) {
    // 注册事件处理器
    app.get("OnQueryDivingFish", handleQueryDivingFish);
    app.get("OnDivingFishUserInput", handleDivingFishUserInput);
    app.get("OnExecuteHTTPComplete", handleHttpComplete);
    app.get("DivingFish.Refresh", handleRefresh);
}

/**
 * 检查缓存是否有效
 * @returns {boolean}
 */
function isCacheValid() {
    try {
        const cacheTime = Number(globalThis[CACHE_TIMESTAMP_KEY] || 0);
        const now = Date.now();
        return cacheTime > 0 && (now - cacheTime) < CACHE_DURATION_MS;
    } catch {
        return false;
    }
}

/**
 * 获取缓存的音乐数据
 * @returns {Array|null}
 */
function getCachedMusicData() {
    try {
        const data = globalThis[CACHE_KEY];
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * 设置音乐数据缓存
 * @param {Array} data
 */
function setCachedMusicData(data) {
    globalThis[CACHE_KEY] = JSON.stringify(data);
    globalThis[CACHE_TIMESTAMP_KEY] = Date.now();
}

/**
 * 清除缓存
 */
function clearCache() {
    globalThis[CACHE_KEY] = undefined;
    globalThis[CACHE_TIMESTAMP_KEY] = 0;
}

/**
 * 发起 HTTP GET 请求获取音乐数据
 * @returns {string} Sakura Script
 */
function fetchMusicData() {
    return new SakuraScriptBuilder()
        .httpGet(MUSIC_DATA_URL)
        .end()
        .toString();
}

/**
 * 处理 OnQueryDivingFish 事件 - 拉起输入框
 * @param {object} ctx
 */
function handleQueryDivingFish(ctx) {
    const builder = new SakuraScriptBuilder();
    builder.openInputbox(INPUT_BOX_ID, 60, "请输入歌曲名称（支持部分匹配）");
    ctx.res.body = builder.end().toString();
}

/**
 * 处理 OnDivingFishUserInput 事件 - 处理输入框结果
 * @param {object} ctx
 */
function handleDivingFishUserInput(ctx) {
    const inputValue = ctx.req.reference[0];

    // 如果用户取消或超时
    if (!inputValue || inputValue === "timeout" || inputValue === "close") {
        ctx.res.body = new SakuraScriptBuilder()
            .text("已取消搜索。")
            .end()
            .toString();
        return;
    }

    const keyword = inputValue.trim();
    if (!keyword) {
        ctx.res.body = new SakuraScriptBuilder()
            .text("请输入有效的歌曲名称。")
            .end()
            .toString();
        return;
    }

    // 检查缓存
    if (isCacheValid()) {
        const musicData = getCachedMusicData();
        if (musicData) {
            ctx.res.body = searchAndFormat(musicData, keyword);
            return;
        }
    }

    // 缓存无效，存储待处理的搜索请求并获取数据
    pendingSearch = keyword;
    ctx.res.body = fetchMusicData();
}

/**
 * 处理 OnExecuteHTTPComplete 事件 - 处理 HTTP 响应
 * @param {object} ctx
 */
function handleHttpComplete(ctx) {
    const url = ctx.req.reference[1];
    const statusCode = ctx.req.reference[2];
    const body = ctx.req.reference[3];

    // 只处理 Diving-Fish 音乐数据请求
    if (url !== MUSIC_DATA_URL) {
        return;
    }

    if (statusCode === "200" && body) {
        try {
            const musicData = JSON.parse(body);
            setCachedMusicData(musicData);

            // 如果有待处理的搜索请求
            if (pendingSearch) {
                ctx.res.body = searchAndFormat(musicData, pendingSearch);
                pendingSearch = null;
            }
        } catch (e) {
            console.error("Failed to parse music data:", e);
            ctx.res.body = new SakuraScriptBuilder()
                .text("获取歌曲数据失败，请稍后再试。")
                .end()
                .toString();
        }
    } else {
        ctx.res.body = new SakuraScriptBuilder()
            .text("获取歌曲数据失败（HTTP " + statusCode + "），请稍后再试。")
            .end()
            .toString();
    }
}

/**
 * 处理 DivingFish.Refresh 事件 - 手动刷新缓存
 * @param {object} ctx
 */
function handleRefresh(ctx) {
    clearCache();
    ctx.res.body = new SakuraScriptBuilder()
        .text("正在刷新歌曲数据...")
        .httpGet(MUSIC_DATA_URL)
        .end()
        .toString();
}

/**
 * 搜索歌曲并格式化结果
 * @param {Array} musicData
 * @param {string} keyword
 * @returns {string} Sakura Script
 */
function searchAndFormat(musicData, keyword) {
    const results = filterSongs(musicData, keyword);
    return formatSearchResults(results, keyword);
}

/**
 * 根据关键词过滤歌曲
 * @param {Array} musicData
 * @param {string} keyword
 * @returns {Array}
 */
function filterSongs(musicData, keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return musicData.filter(song => {
        // 标题匹配
        if (song.title && song.title.toLowerCase().includes(lowerKeyword)) {
            return true;
        }
        // 艺术家匹配
        if (song.basic_info && song.basic_info.artist &&
            song.basic_info.artist.toLowerCase().includes(lowerKeyword)) {
            return true;
        }
        return false;
    });
}

/**
 * 格式化搜索结果
 * @param {Array} results
 * @param {string} keyword
 * @returns {string} Sakura Script
 */
function formatSearchResults(results, keyword) {
    const builder = new SakuraScriptBuilder();

    if (results.length === 0) {
        builder.text("未找到与「" + keyword + "」相关的歌曲。\\e");
        return builder.toString();
    }

    if (results.length === 1) {
        const song = results[0];
        builder
            .text("找到1首歌曲：\\n")
            .text("标题：" + song.title + "\\n")
            .text("类型：" + song.type + "\\n")
            .text("艺术家：" + (song.basic_info?.artist || "未知") + "\\n")
            .text("流派：" + (song.basic_info?.genre || "未知") + "\\n")
            .text("版本：" + (song.basic_info?.from || "未知") + "\\n")
            .text("定数：" + (song.ds ? song.ds.join(", ") : "未知"))
            .text("\\e");
        return builder.toString();
    }

    // 多个结果，显示前5个
    const displayCount = Math.min(results.length, 5);
    builder.text("找到" + results.length + "首相关歌曲：\\n");

    for (let i = 0; i < displayCount; i++) {
        const song = results[i];
        builder.text((i + 1) + ". " + song.title + " (" + song.type + ")\\n");
    }

    if (results.length > 5) {
        builder.text("...还有" + (results.length - 5) + "首\\n");
        builder.text("请使用更精确的关键词搜索。");
    }

    builder.text("\\e");
    return builder.toString();
}
