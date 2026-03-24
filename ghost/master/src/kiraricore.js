// kiraricore.js — QuickJS/DLL port
// Stripped of all Node.js APIs (readline, fs, process, require).
// Input arrives via __shiori_request(rawString), not from stdin.
// KirariCore.dispatch(rawString) → responseString

import { KashiwazakiParser } from './kashiwazakiParser.mjs';

// ---------------------------------------------------------------------------
// Minimal console stub (QuickJS has no built-in console)
// ---------------------------------------------------------------------------
if (typeof console === 'undefined') {
    globalThis.console = {
        log:   () => {},
        warn:  () => {},
        error: () => {},
    };
}

// ---------------------------------------------------------------------------
// KirariCore 
// ---------------------------------------------------------------------------

export class KirariCore {
    /**
     * @param {object} config
     * @param {"SHIORI"|"SAORI"|"PLUGIN"|"HEADLINE"} [config.protocol]
     */
    constructor(config = {}) {
        this.EnvVar = {}
        this.config = config;
        this.protocol = config.protocol ?? 'SHIORI';
        this.parser = new KashiwazakiParser(this.protocol);
        /** @type {Function[]} */
        this.middleware = [];
        this.eventListener = { GET: {}, NOTIFY: {} };
        globalThis.KirariCoreGlobalEnv = {};
    }

    // ── Middleware ──────────────────────────────────────────────────────────

    /**
     * @param {string} id  SHIORI event ID
     * @param {KirariMiddlewareFunction} fn
     */
    use(fn) {
        this.middleware.push(fn);
    }

    // ── Event listeners ─────────────────────────────────────────────────────

    /**
     * @param {string|string[]} methods
     * @param {string} id  SHIORI event ID
     * @param {KirariMiddlewareFunction} fn
     */
    addEventListener(methods, id, fn) {
        const list = Array.isArray(methods) ? methods : [methods];
        for (const m of list) {
            this.eventListener[m.toUpperCase()][id] = fn;
        }
    }
    /**
     * @param {string} id  SHIORI event ID
     * @param {KirariMiddlewareFunction} fn
     */
    get(id, fn)    { this.addEventListener('GET',    id, fn); }
    /**
     * @param {string} id  SHIORI event ID
     * @param {function(shioriContext):void} fn
     */
    notify(id, fn) { this.addEventListener('NOTIFY', id, fn); }

    // ── Main entry ──────────────────────────────────────────────────────────

    /**
     * Dispatch a raw SHIORI request string, return a raw response string.
     * Called by __shiori_request.
     * @param {string} rawRequest
     * @returns {string}
     */
    dispatch(rawRequest) {
        // const ctxid = String(++_ctxSeq);
        const ctxid = uuidGen();
        let parsed;
        try {
            parsed = this.parser.parseRequest(rawRequest);
        } catch (e) {
            // Parser itself failed – return 400
            const ctx = new shioriContext(ctxid, null, this);
            return ctx._error400(e);
        }

        const ctx = new shioriContext(ctxid, parsed, this);

        try {
            let idx = 0;
            const next = () => {
                const mw = this.middleware[idx++];
                if (mw) {
                    mw(ctx, next);
                } else {
                    const method = ctx.req.method.toUpperCase();
                    const id     = ctx.req.headers['ID'];
                    const handler = this.eventListener[method]?.[id];
                    if (!handler) {
                        ctx.onError(
                            new Error('SHIORI EVENT LISTENER NOT FOUND: ' + id),
                            'notice',
                        );
                    } else {
                        handler(ctx);
                    }
                }
            };
            next();
        } catch (e) {
            ctx.onError(e, 'warning',
                'KIRARICORE MIDDLEWARE/LISTENER ERROR: ' + e.message);
        }

        if (!ctx.responseSent) {
            ctx.responseStart();
        }
        return ctx._responseString ?? '';
    }
}

// ---------------------------------------------------------------------------
// shioriContext
// ---------------------------------------------------------------------------

export class shioriContext {
    /**
     * @param {string} ctxid
     * @param {import('./kashiwazakiParser.mjs').RequestObject|null} parseResult
     * @param {KirariCore} app
     */
    constructor(ctxid, parseResult, app) {
        this.ctxid = ctxid;
        this.app   = app;
        this.state = {};
        if (parseResult) {
            this.req = {
                method:    parseResult.requestLine.method,
                version:   parseResult.requestLine.version,
                protocol:  parseResult.requestLine.protocol,
                headers:   parseResult.headers,
                reference: parseResult.reference ?? [],
            };
        } else {
            // Fallback for parse failures
            this.req = { method: 'GET', version: '3.0',
                         protocol: app.protocol, headers: {}, reference: [] };
        }

        this.res = { code: 200, headers: {}, body: undefined };
        this.responseSent   = false;
        this._responseString = '';
    }

    // ── Error helpers ───────────────────────────────────────────────────────

    _error400(err) {
        return this.app.parser.buildResponse({
            responseLine: { statusCode: 400, version: '3.0', protocol: this.app.protocol },
            headers: {
                Charset:  'UTF-8',
                Sender:   'KirariCore',
                ErrorLevel: 'error',
                ErrorDescription: err.message,
                'X-KirariCore-ContextID': this.ctxid,
            },
            reference: [],
        });
    }

    /**
     * @param {Error}  err
     * @param {string} level   'info'|'notice'|'warning'|'error'|'critical'
     * @param {string} [edesp] human-readable description
     */
    onError(err, level, edesp) {
        const code   = this.req.method === 'NOTIFY' ? 204 : 500;
        const stack  = (err.stack ?? String(err))
            .replace(/\r/g, '\\r').replace(/\n/g, '\\n');

        this.res.code = code;
        this.res.headers = {
            ErrorLevel:       level,
            ErrorDescription: edesp ?? err.message,
            'X-KirariCore-ContextID': this.ctxid,
            'X-KirariCore-Error':     stack,
        };
        this.res.body = code === 500
            ? 'ERROR_KIRARICORE_INTERNAL_SERVER_ERROR'
            : undefined;
        this.responseStart();
    }

    // ── Response ─────────────────────────────────────────────────────────────

    responseStart() {
        if (this.responseSent) return;
        this.responseSent = true;

        const headers = {
            Charset: 'UTF-8',
            Sender:  'KirariCore',
            'X-KirariCore-ContextID': this.ctxid,
            ...this.res.headers,
        };
        if (this.res.body !== undefined) {
            headers['Value'] = this.res.body;
        }

        this._responseString = this.app.parser.buildResponse({
            responseLine: {
                statusCode: this.res.code,
                version:    '3.0',
                protocol:   this.app.protocol,
            },
            headers,
            reference: this.res.reference ?? [],
        });
    }
}


function uuidGen(){
    // 生成一个简单的 UUID（不保证全局唯一，仅供示例）
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * @typedef {function(shioriContext, function():void):void} KirariMiddlewareFunction
 * Middleware signature: receives context and next callback.
 * Must call next() to pass control to the next middleware or handler.
 */