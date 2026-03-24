/**
 * shioriEcho.js — Ghost_Terminal middleware for KirariCore
 *
 * Colorizer, inspector & completion adapted from QuickJS-ng repl.js
 * Original code Copyright (c) 2017-2020 Fabrice Bellard, Charlie Gordon (MIT)
 *
 * Protocol: https://github.com/Taromati2/ghost_terminal
 * Environment: QuickJS (via SSP SHIORI DLL)
 */
import * as std from 'qjs:std';

/* ═══════════════════════════════════════════════════════════════════════
   Character predicates
   ═══════════════════════════════════════════════════════════════════════ */

function is_alpha(c) {
    return typeof c === "string" &&
        ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z'));
}
function is_digit(c) {
    return typeof c === "string" && (c >= '0' && c <= '9');
}
function is_word(c) {
    return typeof c === "string" &&
        (is_alpha(c) || is_digit(c) || c === '_' || c === '$');
}
function is_balanced(a, b) {
    switch (a + b) {
    case "()": case "[]": case "{}": return true;
    }
    return false;
}

/* ═══════════════════════════════════════════════════════════════════════
   ANSI colours & themes  (from repl.js)
   ═══════════════════════════════════════════════════════════════════════ */

const ansiColors = {
    none:            "\x1b[0m",
    black:           "\x1b[30m",
    red:             "\x1b[31m",
    green:           "\x1b[32m",
    yellow:          "\x1b[33m",
    blue:            "\x1b[34m",
    magenta:         "\x1b[35m",
    cyan:            "\x1b[36m",
    white:           "\x1b[37m",
    gray:            "\x1b[30;1m",
    grey:            "\x1b[30;1m",
    bright_red:      "\x1b[31;1m",
    bright_green:    "\x1b[32;1m",
    bright_yellow:   "\x1b[33;1m",
    bright_blue:     "\x1b[34;1m",
    bright_magenta:  "\x1b[35;1m",
    bright_cyan:     "\x1b[36;1m",
    bright_white:    "\x1b[37;1m",
};

const colorThemes = {
    dark: {
        'annotation': 'cyan',
        'boolean':    'bright_white',
        'comment':    'white',
        'date':       'magenta',
        'default':    'bright_green',
        'error':      'bright_red',
        'function':   'bright_yellow',
        'identifier': 'bright_green',
        'keyword':    'bright_white',
        'null':       'bright_white',
        'number':     'green',
        'other':      'white',
        'propname':   'white',
        'regexp':     'cyan',
        'string':     'bright_cyan',
        'symbol':     'bright_white',
        'type':       'bright_magenta',
        'undefined':  'bright_white',
    },
    light: {
        'annotation': 'cyan',
        'boolean':    'bright_magenta',
        'comment':    'grey',
        'date':       'magenta',
        'default':    'black',
        'error':      'red',
        'function':   'bright_yellow',
        'identifier': 'black',
        'keyword':    'bright_magenta',
        'null':       'bright_magenta',
        'number':     'green',
        'other':      'black',
        'propname':   'black',
        'regexp':     'cyan',
        'string':     'bright_cyan',
        'symbol':     'grey',
        'type':       'bright_magenta',
        'undefined':  'bright_magenta',
    },
};

/* ═══════════════════════════════════════════════════════════════════════
   JavaScript syntax colorizer  (from QuickJS-ng repl.js)

   Returns [state, level, styleArray]
     state:      string of unclosed delimiters ("" = expression complete)
     level:      brace/bracket/paren nesting depth
     styleArray: per-character style-name array
   ═══════════════════════════════════════════════════════════════════════ */

function colorize_js(str) {
    var i, c, start, n = str.length;
    var style, state = "", level = 0;
    var can_regex = 1;
    var r = [];

    function push_state(ch) { state += ch; }
    function last_state() { return state.substring(state.length - 1); }
    function pop_state() {
        var ch = last_state();
        state = state.substring(0, state.length - 1);
        return ch;
    }

    function parse_block_comment() {
        style = 'comment';
        push_state('/');
        for (i++; i < n - 1; i++) {
            if (str[i] === '*' && str[i + 1] === '/') {
                i += 2;
                pop_state();
                break;
            }
        }
    }

    function parse_line_comment() {
        style = 'comment';
        for (i++; i < n; i++) {
            if (str[i] === '\n') break;
        }
    }

    function parse_string(delim) {
        style = 'string';
        push_state(delim);
        while (i < n) {
            c = str[i++];
            if (c === '\n') { style = 'error'; continue; }
            if (c === '\\') { if (i >= n) break; i++; }
            else if (c === delim) { pop_state(); break; }
        }
    }

    function parse_regex() {
        style = 'regexp';
        push_state('/');
        while (i < n) {
            c = str[i++];
            if (c === '\n') { style = 'error'; continue; }
            if (c === '\\') { if (i < n) i++; continue; }
            if (last_state() === '[') {
                if (c === ']') pop_state();
                continue;
            }
            if (c === '[') {
                push_state('[');
                if (str[i] === '[' || str[i] === ']') i++;
                continue;
            }
            if (c === '/') {
                pop_state();
                while (i < n && is_word(str[i])) i++;
                break;
            }
        }
    }

    function parse_number() {
        style = 'number';
        while (i < n && (is_word(str[i]) ||
               (str[i] === '.' && (i === n - 1 || str[i + 1] !== '.')))) {
            i++;
        }
    }

    var js_keywords = "|" +
        "break|case|catch|continue|debugger|default|delete|do|" +
        "else|finally|for|function|if|in|instanceof|new|" +
        "return|switch|this|throw|try|typeof|while|with|" +
        "class|const|enum|import|export|extends|super|" +
        "implements|interface|let|package|private|protected|" +
        "public|static|yield|" +
        "undefined|null|true|false|Infinity|NaN|" +
        "eval|arguments|await|";

    var js_no_regex = "|this|super|undefined|null|true|false|Infinity|NaN|arguments|";
    var js_types = "|void|var|";

    function parse_identifier() {
        can_regex = 1;
        while (i < n && is_word(str[i])) i++;
        var s = str.substring(start, i);
        var w = '|' + s + '|';

        if (js_keywords.indexOf(w) >= 0) {
            style = 'keyword';
            if (s === 'true' || s === 'false') style = 'boolean';
            else if (s === 'null') style = 'null';
            else if (s === 'undefined') style = 'undefined';
            if (js_no_regex.indexOf(w) >= 0) can_regex = 0;
            return;
        }
        var i1 = i;
        while (i1 < n && str[i1] === ' ') i1++;
        if (i1 < n && str[i1] === '(') { style = 'function'; return; }
        if (js_types.indexOf(w) >= 0) { style = 'type'; return; }
        style = 'identifier';
        can_regex = 0;
    }

    function set_style(from, to) {
        while (r.length < from) r.push('default');
        while (r.length < to)   r.push(style);
    }

    for (i = 0; i < n;) {
        style = null;
        start = i;
        switch (c = str[i++]) {
        case ' ': case '\t': case '\r': case '\n':
            continue;
        case '+': case '-':
            if (i < n && str[i] === c) { i++; continue; }
            can_regex = 1;
            continue;
        case '/':
            if (i < n && str[i] === '*') { parse_block_comment(); break; }
            if (i < n && str[i] === '/') { parse_line_comment(); break; }
            if (can_regex) { parse_regex(); can_regex = 0; break; }
            can_regex = 1;
            continue;
        case '\'': case '\"': case '`':
            parse_string(c);
            can_regex = 0;
            break;
        case '(': case '[': case '{':
            can_regex = 1;
            level++;
            push_state(c);
            continue;
        case ')': case ']': case '}':
            can_regex = 0;
            if (level > 0 && is_balanced(last_state(), c)) {
                level--;
                pop_state();
                continue;
            }
            style = 'error';
            break;
        default:
            if (is_digit(c)) { parse_number(); can_regex = 0; break; }
            if (is_word(c))  { parse_identifier(); break; }
            can_regex = 1;
            continue;
        }
        if (style) set_style(start, i);
    }
    set_style(n, n);
    return [state, level, r];
}

/**
 * Apply colorize_js and produce an ANSI-coloured string.
 * If `context` is provided it is prepended (for multi-line context);
 * only the portion after `context` is returned.
 *
 * @param {string} line     Current input line
 * @param {string} context  Accumulated previous lines (may be "")
 * @param {object} styles   Active theme map  e.g. colorThemes.dark
 * @returns {string}
 */
function colorize_to_ansi(line, context, styles) {
    var full = context ? context + '\n' + line : line;
    var start = full.length - line.length;
    var result = colorize_js(full);
    var sn = result[2]; // per-character style names

    var out = '';
    for (var i = start; i < full.length;) {
        var st = (i < sn.length) ? sn[i] : 'default';
        var j = i + 1;
        while (j < full.length && ((j < sn.length ? sn[j] : 'default') === st)) j++;
        var cn = styles[st] || 'none';
        out += (ansiColors[cn] || ansiColors.none) + full.substring(i, j);
        i = j;
    }
    out += ansiColors.none;
    return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   Number formatting  (from repl.js)
   ═══════════════════════════════════════════════════════════════════════ */

function number_to_string(a, radix) {
    if (!isFinite(a)) return a.toString();
    if (a === 0) return (1 / a < 0) ? "-0" : "0";
    if (radix === 16 && a === Math.floor(a)) {
        var s = a < 0 ? "-" : "";
        return s + "0x" + Math.abs(a).toString(16);
    }
    return a.toString();
}

function bigint_to_string(a, radix) {
    if (radix === 16) {
        var s = a < 0n ? "-" : "";
        var v = a < 0n ? -a : a;
        return s + "0x" + v.toString(16) + "n";
    }
    return a.toString() + "n";
}

/* ═══════════════════════════════════════════════════════════════════════
   Value inspector  (adapted from repl.js util.inspect)
   ═══════════════════════════════════════════════════════════════════════ */

function inspectValue(val, opts) {
    opts = opts || {};
    var show_hidden = !!opts.showHidden;
    var max_depth   = (opts.depth === undefined)       ? 2    : (opts.depth === null) ? Infinity : opts.depth;
    var use_colors  = (opts.colors === undefined)      ? true : opts.colors;
    var hex_mode    = !!opts.hexMode;
    var styles      = opts.styles || colorThemes.dark;
    var breakLength = opts.breakLength || 80;
    var maxArrayLength  = opts.maxArrayLength  || 100;
    var maxObjectLength = (opts.maxObjectLength || maxArrayLength + 10);
    var maxStringLength = opts.maxStringLength || 78;

    var refs    = [{}];
    var stack   = [];
    var tokens  = [];
    var output  = [];
    var last_style = 'none';

    function class_tag(o) {
        return Object.prototype.toString.call(o).slice(8, -1);
    }
    function quote_str(s) {
        if (s.indexOf("'") >= 0) return JSON.stringify(s);
        var r = JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"');
        return "'" + r + "'";
    }
    function push_token(s) { tokens.push("" + s); }
    function append_token(s) { tokens[tokens.length - 1] += s; }

    function print_rec(a, lvl) {
        var n, n0, i, k, keys, type, isarray, noindex, nokeys, brace, sep, len;

        switch (type = typeof a) {
        case "undefined":
        case "boolean":
            push_token(a);
            break;
        case "number":
            push_token(number_to_string(a, hex_mode ? 16 : 10));
            break;
        case "bigint":
            push_token(bigint_to_string(a, hex_mode ? 16 : 10));
            break;
        case "string":
            if (a.length > maxStringLength) a = a.substring(0, maxStringLength) + "...";
            push_token(quote_str(a));
            break;
        case "symbol":
            push_token(String(a));
            break;
        case "object":
        case "function":
            if (a === null) { push_token(a); break; }
            if ((n = refs.indexOf(a)) >= 0) { push_token("[Circular *" + n + "]"); break; }
            if ((n = stack.indexOf(a)) >= 0) {
                push_token("[Circular *" + refs.length + "]");
                refs.push(stack[n]);
                break;
            }
            var obj_index = tokens.length;
            var tag = class_tag(a);
            stack.push(a);

            if (a instanceof Date) {
                push_token("Date " + JSON.stringify(a.toGMTString()));
            } else if (a instanceof RegExp) {
                push_token(a.toString());
            } else if (a instanceof Boolean || a instanceof Number) {
                push_token("[" + tag + ": " + a + "]");
            } else if (typeof BigInt !== 'undefined' && a instanceof BigInt) {
                push_token("[" + tag + ": " + a + "]");
            } else if (a instanceof String) {
                push_token("[" + tag + ": " + quote_str(a) + "]");
                len = a.length;
                noindex = 1;
            } else if (Array.isArray(a)) {
                push_token("[");
                isarray = 1;
            } else if (a instanceof Error) {
                push_token(a.name + ": " + a.message);
                if (a.stack) append_token("\n" + a.stack);
            } else if (tag.indexOf('Array') >= 0 && typeof Uint8Array !== 'undefined' &&
                       a instanceof (Object.getPrototypeOf(Uint8Array))) {
                push_token(tag + "(" + a.length + ") [");
                isarray = 1;
            } else if (type === 'function') {
                push_token(a.name ? "[Function: " + a.name + "]" : "[Function (anonymous)]");
            } else {
                var cons = (a.constructor && a.constructor.name) || 'Object';
                if (tag !== 'Object') {
                    push_token(cons + " [" + tag + "] {");
                } else if (a.__proto__ === null) {
                    push_token("[" + cons + ": null prototype] {");
                } else if (cons !== 'Object') {
                    push_token(cons + " {");
                } else {
                    push_token("{");
                }
                brace = "}";
            }

            keys = null; n = 0; n0 = 0; k = 0;
            if (isarray) {
                brace = "]";
                len = a.length;
                if (lvl > max_depth && len) {
                    push_token("...");
                    push_token(brace);
                    stack.pop();
                    return;
                }
                for (i = 0; i < len; i++) {
                    k++;
                    if (i in a) {
                        print_rec(a[i], lvl + 1);
                    } else {
                        var s2 = i;
                        while (i + 1 < len && !((i + 1) in a)) i++;
                        if (i > s2) push_token("<" + (i - s2 + 1) + " empty items>");
                        else push_token("<empty>");
                    }
                    if (k >= maxArrayLength && len - k > 5) {
                        push_token("... " + (len - k) + " more items");
                        break;
                    }
                }
                noindex = 1;
                if (i !== len && len > 1000) nokeys = 1;
            }

            if (!nokeys) {
                keys = show_hidden ? Object.getOwnPropertyNames(a) : Object.keys(a);
                n = keys.length;
            }
            if (noindex) {
                for (; n0 < n; n0++) {
                    i = +keys[n0];
                    if (i !== (i >>> 0) || i >= len) break;
                }
            }
            if (n0 < n) {
                if (!brace) { append_token(" {"); brace = "}"; }
                if (lvl > max_depth && n0 < n) {
                    push_token("...");
                    push_token(brace);
                    stack.pop();
                    return;
                }
                for (i = n0; i < n; i++) {
                    var key = keys[i];
                    var desc;
                    try { desc = Object.getOwnPropertyDescriptor(a, key); } catch(_) { continue; }
                    if (!desc) continue;
                    if (!desc.enumerable)
                        push_token("[" + String(key) + "]");
                    else if (+key === (key >>> 0) ||
                             (typeof key === 'string' && key.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*/)))
                        push_token(key);
                    else
                        push_token(quote_str(key));
                    push_token(":");
                    if ('value' in desc) {
                        print_rec(desc.value, lvl + 1);
                    } else {
                        var fields = [];
                        if (desc.get) fields.push("Getter");
                        if (desc.set) fields.push("Setter");
                        push_token("[" + fields.join('/') + "]");
                    }
                    k++;
                    if (k > maxObjectLength && n - k > 5) {
                        push_token("... " + (n - k) + " more properties");
                        break;
                    }
                }
            }
            if (brace) push_token(brace);
            stack.pop();
            if ((i = refs.indexOf(a)) > 0)
                tokens[obj_index] = "<ref *" + i + "> " + tokens[obj_index];
            break;
        default:
            push_token(String(a));
            break;
        }
    }

    // ── Output formatting with colour ─────────────────────────────────

    function output_str(s, st) {
        if (use_colors) {
            if (last_style !== st) {
                output.push(ansiColors.none);
                last_style = st;
            }
            if (st) {
                var col = ansiColors[styles[st]];
                if (col) output.push(col);
            }
        }
        output.push(s);
    }

    function output_propname(s) {
        if (s[0] >= '0' && s[0] <= '9')
            output_str(s, 'number');
        else
            output_str(s, 'propname');
        output_str(": ");
    }

    function is_block(s) {
        var ch = s[s.length - 1];
        return ch === '[' || ch === '{';
    }

    function output_pretty(s) {
        if (!use_colors) { output_str(s); return; }
        while (s.length > 0) {
            var st = 'none', chunk = s, len = 0, m = null;
            switch (s[0]) {
            case '"':  st = 'string'; m = s.match(/^"([^\\"]|\\.)*"/); break;
            case '\'': st = 'string'; m = s.match(/^'([^\\']|\\.)*'/); break;
            case '/':  st = 'regexp'; break;
            case '<':
                m = s.match(/^<[^>]+>/);
                if (m) st = 'annotation';
                break;
            case '[':
                m = s.match(/^\[[^\]]+\]/);
                if (m) { st = 'annotation'; break; }
                /* fall through */
            case ']': case '}': case ',': case ' ':
                st = 'other'; len = 1; break;
            case '.': st = 'annotation'; break;
            case '0': case '1': case '2': case '3': case '4':
            case '5': case '6': case '7': case '8': case '9':
                st = 'number';
                m = s.match(/^[0-9a-z_]+[.]?[0-9a-z_]*[eEpP]?[+-]?[0-9]*/);
                break;
            case '-': len = 1; break;
            default:
                if (is_block(s)) len = s.length - 1;
                if (s.substring(0,4) === 'Date')     st = 'date';
                else if (s.substring(0,6) === 'Symbol') st = 'symbol';
                else if (s === 'Infinity' || s === 'NaN') st = 'keyword';
                else if (s === 'true' || s === 'false')   st = 'boolean';
                else if (s === 'null')       st = 'null';
                else if (s === 'undefined')  st = 'undefined';
                break;
            }
            if (m) len = m[0].length;
            if (len > 0) chunk = s.slice(0, len);
            output_str(chunk, st);
            s = s.slice(chunk.length);
        }
    }

    function block_width(idx) {
        var w = tokens[idx].length;
        if (tokens[idx + 1] === ":") {
            idx += 2;
            w += 2 + tokens[idx].length;
        }
        var width = w;
        if (is_block(tokens[idx])) {
            var seplen = 1;
            while (++idx < tokens.length) {
                width += seplen;
                var s = tokens[idx];
                if (s === ']' || s === '}') break;
                var bw = block_width(idx);
                idx = bw[0]; w = bw[1];
                width += w;
                seplen = 2;
            }
        }
        return [idx, width];
    }

    function output_single(i, last) {
        var sep = "";
        while (i <= last) {
            var s = tokens[i++];
            if (s === ']' || s === '}') {
                if (sep.length > 1) output_str(" ");
            } else {
                output_str(sep);
                if (tokens[i] === ":") { output_propname(s); i++; s = tokens[i++]; }
            }
            output_pretty(s);
            sep = is_block(s) ? " " : ", ";
        }
    }

    function output_spaces(s, count) {
        if (count > 0) s += " ".repeat(count);
        output_str(s);
    }

    function output_indent(indent, from) {
        var avail = breakLength - indent - 2;
        var bw = block_width(from);
        var last = bw[0], width = bw[1];
        if (width <= avail) { output_single(from, last); return [last, width]; }

        if (tokens[from + 1] === ":") {
            output_propname(tokens[from]);
            from += 2;
        }
        output_pretty(tokens[from]);
        if (!is_block(tokens[from])) return [from, width];

        indent += 2; avail -= 2;
        var sep = "", first = from + 1, i2, w2;

        if (tokens[from].indexOf('[') >= 0) {
            var k = 0, tab = [];
            for (var ii = first; ii < last; ii++) {
                if (tokens[ii][0] === '.' || tokens[ii + 1] === ':') break;
                var bw2 = block_width(ii);
                ii = bw2[0]; tab[k++] = bw2[1];
            }
            var colwidth, cols;
            for (cols = Math.min(Math.floor(avail / 3), tab.length, 16); cols > 1; cols--) {
                colwidth = [];
                var col0 = 0;
                for (var kk = 0; kk < tab.length; kk++) {
                    colwidth[col0] = Math.max(colwidth[col0] || 0, tab[kk] + 2);
                    col0 = (col0 + 1) % cols;
                }
                var tw = 0;
                for (col0 = 0; col0 < cols; col0++) tw += colwidth[col0];
                if (tw <= avail) break;
            }
            if (cols > 1) {
                var cw = 0, col = cols - 1;
                for (var ii2 = first; ii2 < last; ii2++) {
                    if (tokens[ii2][0] === '.' || tokens[ii2 + 1] === ':') break;
                    cw += sep.length;
                    output_str(sep); sep = ",";
                    if (col === cols - 1) {
                        output_spaces("\n", indent); col = 0;
                    } else {
                        output_spaces("", colwidth[col++] - cw);
                    }
                    var bw3 = output_indent(indent, ii2);
                    ii2 = bw3[0]; cw = bw3[1];
                }
                first = ii2;
            }
        }

        for (i2 = first; i2 < last; i2++) {
            output_str(sep); sep = ",";
            output_spaces("\n", indent);
            var bw4 = output_indent(indent, i2);
            i2 = bw4[0];
        }
        output_spaces("\n", indent -= 2);
        output_pretty(tokens[last]);
        return [last, breakLength];
    }

    // ── Run ──

    print_rec(val, 0);
    if (tokens.length > 0) {
        output_indent(0, 0);
        output_str("");
    }
    return output.join("");
}

/* ═══════════════════════════════════════════════════════════════════════
   Auto-completion  (adapted from repl.js)
   ═══════════════════════════════════════════════════════════════════════ */

var ac_keywords = [
    "await ", "catch (", "class ", "const ", "else ", "export ", "for ",
    "function ", "if (", "import ", "instanceof ", "let ", "new ",
    "return", "super ", "this", "try {", "typeof ", "var ", "while (",
    "yield ",
];

function is_named_property(line, end) {
    var pos = end;
    while (pos > 0 && is_word(line[pos - 1])) pos--;
    while (pos > 0 && " \t".indexOf(line[pos - 1]) >= 0) pos--;
    return pos > 0 && line[pos - 1] === ".";
}

function get_context_word(line, end) {
    var pos = end;
    while (pos > 0 && is_word(line[pos - 1])) pos--;
    return line.slice(pos, end);
}

function get_context_object(line, pos, gObj, dirObj) {
    if (pos <= 0) return gObj;
    var c = line[pos - 1];
    if (pos === 1 && (c === '\\' || c === '.'))
        return dirObj || {};
    if ("'\"`@#)]}\\".indexOf(c) >= 0)
        return void 0;
    if (c === ".") {
        pos--;
        c = line[pos - 1];
        if (c === '\'' || c === '\"' || c === '`') return "a";
        if (c === ']') return [];
        if (c === '/') return / /;
        if (is_word(c)) {
            var base = get_context_word(line, pos);
            var base_pos = pos - base.length;
            if (base === 'true' || base === 'false') return true;
            if (base === 'null') return null;
            if (base === 'this') return gObj;
            if (!isNaN(+base)) return 0;
            var obj = get_context_object(line, base_pos, gObj, dirObj);
            if (obj === null || obj === void 0) return obj;
            try {
                if (typeof obj[base] !== 'undefined') return obj[base];
            } catch(_) {}
            if (base_pos >= 3 && line[base_pos - 1] === '/' &&
                base.match(/^[dgimsuvy]+$/))
                return RegExp();
        }
        return {};
    }
    return gObj;
}

function get_completions(line, pos, gObj, dirObj) {
    var s = get_context_word(line, pos);
    var ctx_obj = get_context_object(line, pos - s.length, gObj, dirObj);
    var r = [];

    if (!is_named_property(line, pos)) {
        for (var ki = 0; ki < ac_keywords.length; ki++) {
            if (ac_keywords[ki].substring(0, s.length) === s)
                r.push(ac_keywords[ki]);
        }
    }

    for (var depth = 0, obj = ctx_obj;
         depth < 10 && obj !== null && obj !== void 0; depth++) {
        var props;
        try { props = Object.getOwnPropertyNames(obj); } catch(_) { break; }
        for (var pi = 0; pi < props.length; pi++) {
            var prop = props[pi];
            if (typeof prop === "string" && "" + (+prop) !== prop &&
                prop.substring(0, s.length) === s) {
                r.push(prop);
            }
        }
        try { obj = Object.getPrototypeOf(obj); } catch(_) { break; }
    }

    if (r.length > 1) {
        function symcmp(a, b) {
            if (a[0] !== b[0]) {
                if (a[0] === '_') return 1;
                if (b[0] === '_') return -1;
            }
            return a < b ? -1 : a > b ? 1 : 0;
        }
        r.sort(symcmp);
        var j2 = 1;
        for (var i2 = 1; i2 < r.length; i2++) {
            if (r[i2] !== r[i2 - 1]) r[j2++] = r[i2];
        }
        r.length = j2;
    }

    return { tab: r, pos: s.length, ctx: ctx_obj };
}

/* ═══════════════════════════════════════════════════════════════════════
   Config typedef
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * @typedef {Object} shioriEchoConfigObject
 * @property {string}   [title]                   - Terminal window title
 * @property {string}   [icon]                    - Terminal window icon path
 * @property {string}   [smallIcon]               - Small icon (falls back to icon)
 * @property {string}   [ghostName]               - Ghost name for login banner
 * @property {string}   [userName]                - User name for login banner
 * @property {string}   [customLoginInfo]         - Override default login text
 * @property {string}   [customBeginSakuraScript] - SakuraScript on terminal open
 * @property {string}   [prompt]                  - Prompt string (default "> ")
 * @property {boolean}  [commandLog]              - Log commands to file
 * @property {string}   [commandLogPath]          - Log path
 * @property {'dark'|'light'} [theme]             - Colour theme (default "dark")
 * @property {number}   [depth]                   - Inspector depth (default 2)
 * @property {boolean}  [hexMode]                 - Display numbers in hex
 * @property {boolean}  [showHidden]              - Show non-enumerable props
 * @property {boolean}  [useStrict]               - Evaluate in strict mode
 * @property {(cmd:string,ctx:object,print:Function)=>void} [onCommand]
 */

/* ═══════════════════════════════════════════════════════════════════════
   Ghost_Terminal middleware
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * @param {import("./kiraricore.js").KirariCore} app
 * @param {shioriEchoConfigObject} [config]
 */
export function loadShioriEcho(app, config = {}) {
    if (app.EnvVar.isShioriEchoEnabled)
        throw new Error("ShioriEcho is already enabled.");

    // ── REPL state ─────────────────────────────────────────────────────

    var outputBuffer   = "";
    var isTerminalOpen = false;
    var terminalAction = null;   // null | "end" | "continue"
    var commandHistory = [];

    // multi-line expression accumulation (à la repl.js)
    var mexpr     = "";
    var mlLevel   = 0;
    var mlPstate  = "";

    // configurable options (may be changed at runtime via directives)
    var activeStyles  = colorThemes[config.theme] || colorThemes.dark;
    var show_depth    = config.depth       ?? 2;
    var show_hidden   = config.showHidden  ?? false;
    var show_colors   = true;
    var hex_mode      = config.hexMode     ?? false;
    var use_strict    = config.useStrict   ?? false;

    // tab-completion session cache
    var tabCache = { candidates: [], replaceStart: 0, prefix: "" };

    // ── Helpers ────────────────────────────────────────────────────────

    function encodeSpecial(str) {
        return str
            .replace(/\\/g, "\\\\")
            .replace(/\t/g, "\\t")
            .replace(/\r\n/g, "\\n")
            .replace(/\n/g, "\\n");
    }

    var originalConsoleLog = globalThis.console ? globalThis.console.log : null;

    function appendOutput(text) { outputBuffer += text; }

    /** Console.log-style output (for user code / console.log interception) */
    function print() {
        var parts = [];
        for (var ai = 0; ai < arguments.length; ai++) {
            var a = arguments[ai];
            parts.push(
                (a !== null && typeof a === 'object')
                    ? inspectValue(a, {
                        depth: show_depth, colors: show_colors,
                        showHidden: show_hidden, hexMode: hex_mode,
                        styles: activeStyles,
                      })
                    : String(a)
            );
        }
        appendOutput(parts.join(' ') + "\n");
        if (originalConsoleLog) originalConsoleLog.apply(globalThis.console, arguments);
    }

    /** Pretty-print a single eval result */
    function printValue(val) {
        appendOutput(inspectValue(val, {
            depth: show_depth, colors: show_colors,
            showHidden: show_hidden, hexMode: hex_mode,
            styles: activeStyles,
        }) + "\n");
    }

    function appendToFile(path, text) {
        try {
            if (std) {
                var f = std.open(path, "a");
                if (f) { f.puts(text); f.close(); }
            }
        } catch (_) {}
    }

    // ── Directives ─────────────────────────────────────────────────────

    var directives = Object.create(null);

    directives["help"] = function () {
        appendOutput(
            ".help          print this help\n" +
            ".exit          close the terminal\n" +
            ".depth <n>     set inspector depth  (current: " + show_depth + ")\n" +
            ".hidden        toggle hidden properties  (" + (show_hidden ? "ON" : "OFF") + ")\n" +
            ".color         toggle coloured output    (" + (show_colors ? "ON" : "OFF") + ")\n" +
            ".x             hexadecimal numbers       (" + (hex_mode    ? "ON" : "OFF") + ")\n" +
            ".dec           decimal numbers\n" +
            ".strict        toggle strict mode         (" + (use_strict  ? "ON" : "OFF") + ")\n" +
            ".dark          select dark theme\n" +
            ".light         select light theme\n" +
            ".load <file>   evaluate a JS file\n" +
            ".clear         clear output\n" +
            "Any other input is evaluated as JavaScript.\n" +
            "Globals: $ctx  $app  _  (last result)\n"
        );
    };

    directives["exit"]   = function () { terminalAction = "end"; };
    directives["x"]      = function () { hex_mode = true; appendOutput("hex mode ON\n"); };
    directives["dec"]    = function () { hex_mode = false; appendOutput("decimal mode ON\n"); };
    directives["strict"] = function () { use_strict = !use_strict; appendOutput("strict mode " + (use_strict ? "ON" : "OFF") + "\n"); };
    directives["hidden"] = function () { show_hidden = !show_hidden; appendOutput("hidden props " + (show_hidden ? "ON" : "OFF") + "\n"); };
    directives["color"]  = function () { show_colors = !show_colors; appendOutput("colours " + (show_colors ? "ON" : "OFF") + "\n"); };
    directives["dark"]   = function () { activeStyles = colorThemes.dark;  appendOutput("dark theme\n"); };
    directives["light"]  = function () { activeStyles = colorThemes.light; appendOutput("light theme\n"); };
    directives["clear"]  = function () { terminalAction = "continue"; appendOutput("\u001b[H\u001b[2J"); };

    directives["depth"] = function (arg) {
        var v = parseInt(arg, 10);
        if (v >= 0) show_depth = v;
        appendOutput("depth = " + show_depth + "\n");
    };

    directives["load"] = function (arg) {
        if (!arg) { appendOutput("usage: .load <file>\n"); return; }
        if (arg.lastIndexOf(".") <= arg.lastIndexOf("/")) arg += ".js";
        try {
            std.loadScript(arg);
            appendOutput("loaded " + arg + "\n");
        } catch (e) {
            appendOutput(ansiColors.bright_red + String(e) + ansiColors.none + "\n");
        }
    };

    /**
     * Try to handle a line as a directive.
     * Returns true if it was a directive; false otherwise.
     */
    function handle_directive(line) {
        if (line === "?") { directives["help"](); return true; }
        if (line[0] !== '\\' && line[0] !== '.') return false;

        var pos = 1;
        while (pos < line.length && line[pos] !== ' ') pos++;
        var cmd_name = line.substring(1, pos);
        var arg = line.substring(pos).trim();

        var match = null, count = 0;
        for (var p in directives) {
            if (p.substring(0, cmd_name.length) === cmd_name) {
                match = p;
                count++;
                if (p === cmd_name) { count = 1; break; }
            }
        }
        if (match && count === 1) {
            directives[match](arg);
        } else {
            appendOutput("Unknown directive: " + cmd_name + "\n");
        }
        return true;
    }

    // ── Eval core ──────────────────────────────────────────────────────

    function eval_and_print(expr) {
        if (use_strict)
            expr = '"use strict"; void 0;\n' + expr;

        var prevLog = globalThis.console ? globalThis.console.log : null;
        if (globalThis.console) globalThis.console.log = print;

        try {
            globalThis.$app = app;

            var result;
            if (typeof std.evalScript === 'function') {
                result = std.evalScript(expr, { backtrace_barrier: true });
            } else {
                result = globalThis.eval(expr);
            }

            // store last result
            globalThis._ = result;

            printValue(result);
        } catch (e) {
            var cs = show_colors ? ansiColors[activeStyles['error']] || '' : '';
            var ce = show_colors ? ansiColors.none : '';
            if (e instanceof Error) {
                appendOutput(cs + e.toString() + ce + "\n");
                if (e.stack) appendOutput(cs + e.stack + ce + "\n");
            } else {
                appendOutput(cs + "Throw: " + String(e) + ce + "\n");
            }
        } finally {
            if (globalThis.console && prevLog !== undefined) {
                globalThis.console.log = prevLog;
            }
        }
    }

    /**
     * Process a command line.  Handles directives, multi-line accumulation,
     * and evaluation.
     */
    function handle_command(line, ctx) {
        globalThis.$ctx = null; // will be set by caller if relevant
        if (mexpr) {
            // we are accumulating a multi-line expression
            var full = mexpr + '\n' + line;
            var cs = colorize_js(full);
            mlPstate = cs[0];
            mlLevel  = cs[1];
            if (mlPstate) {
                // still incomplete
                mexpr = full;
                terminalAction = "continue";
                return;
            }
            // expression is now complete
            mexpr = "";
            mlLevel = 0;
            mlPstate = "";

            globalThis.$ctx = ctx;
            eval_and_print(full);
            return;
        }

        // not in multi-line mode – try directive first
        if (handle_directive(line)) return;

        // check if expression is complete
        var cs = colorize_js(line);
        mlPstate = cs[0];
        mlLevel  = cs[1];
        if (mlPstate) {
            // incomplete – start multi-line accumulation
            mexpr = line;
            terminalAction = "continue";
            return;
        }

        // single-line expression
        globalThis.$ctx = ctx;
        eval_and_print(line);
    }

    // ═════════════════════════════════════════════════════════════════
    // Ghost Terminal event handlers
    // ═════════════════════════════════════════════════════════════════

    // ── ShioriEcho.Begin ───────────────────────────────────────────

    app.get("ShioriEcho.Begin", function (ctx) {
        isTerminalOpen = true;
        outputBuffer   = "";
        commandHistory = [];
        mexpr = "";
        mlLevel = 0;
        mlPstate = "";

        if (config.customBeginSakuraScript)
            ctx.res.body = config.customBeginSakuraScript;

        if (config.title)     ctx.res.headers["X-SSTP-PassThru-Tittle"]    = config.title;
        if (config.icon)      ctx.res.headers["X-SSTP-PassThru-Icon"]      = config.icon;
        if (config.smallIcon) ctx.res.headers["X-SSTP-PassThru-SmallIcon"] = config.smallIcon;

        ctx.res.headers["X-SSTP-PassThru-CustomLoginInfo"] =
            config.customLoginInfo ||
            "KirariCore QuickJS Console\\nType .help for help.";
    });

    // ── ShioriEcho.End ─────────────────────────────────────────────

    app.addEventListener(["GET", "NOTIFY"], "ShioriEcho.End", function () {
        isTerminalOpen = false;
        outputBuffer   = "";
        commandHistory = [];
        mexpr = "";
    });

    // ── ShioriEcho.GetName ─────────────────────────────────────────

    app.get("ShioriEcho.GetName", function (ctx) {
        if (config.ghostName) ctx.res.headers["X-SSTP-PassThru-GhostName"] = config.ghostName;
        if (config.userName)  ctx.res.headers["X-SSTP-PassThru-UserName"]  = config.userName;
    });

    // ── ShioriEcho (main command) ──────────────────────────────────
    //
    // Because GetResult IS defined the terminal ignores all response
    // headers from this handler (except Sakura scripts in Value).
    // Every control decision MUST go through GetResult.

    app.addEventListener(["GET", "NOTIFY"], "ShioriEcho", function (ctx) {
        var command = ctx.req.reference[0] || "";
        outputBuffer   = "";
        terminalAction = null;

        if (command === "" && !mexpr) {
            appendOutput("\x1b[90mundefined\x1b[0m\n");
            return;
        }

        // command logging
        if (config.commandLog && command !== "") {
            appendToFile(
                config.commandLogPath || (typeof __shiori_dir !== 'undefined' ? __shiori_dir + "/REPL_LOG.log" : "./REPL_LOG.log"),
                command + "\n"
            );
        }

        // custom handler override
        if (typeof config.onCommand === 'function') {
            try {
                config.onCommand(command, ctx, print);
            } catch (e) {
                appendOutput(ansiColors.bright_red + "Handler Error: " + e.message + ansiColors.none + "\n");
            }
            if (outputBuffer.length === 0) appendOutput("\x1b[90m(no output)\x1b[0m\n");
            return;
        }

        // normal processing
        handle_command(command, ctx);

        // // safety: ensure GetResult always has something to dispatch
        // if (terminalAction === null && outputBuffer.length === 0)
        //     appendOutput("\x1b[90mundefined\x1b[0m\n");
    });

    // ── ShioriEcho.GetResult ───────────────────────────────────────

    app.get("ShioriEcho.GetResult", function (ctx) {
        if (!isTerminalOpen) {
            ctx.res.headers["X-SSTP-PassThru-Status"] = "End";
            return;
        }

        if (terminalAction === "end") {
            terminalAction = null;
            isTerminalOpen = false;
            ctx.res.headers["X-SSTP-PassThru-Status"] = "End";
            outputBuffer = "";
            commandHistory = [];
            return;
        }
        if (terminalAction === "continue") {
            terminalAction = null;
            ctx.res.headers["X-SSTP-PassThru-Status"] = "Continue";
        }

        if (outputBuffer.length > 0) {
            ctx.res.headers["X-SSTP-PassThru-Special"] = encodeSpecial(outputBuffer);
            outputBuffer = "";
        }

        // safety: never leave terminal in infinite poll
        ctx.res.headers["X-SSTP-PassThru-Status"] = "Continue";
    });

    // ── ShioriEcho.TabPress ────────────────────────────────────────

    app.get("ShioriEcho.TabPress", function (ctx) {
        var command   = ctx.req.reference[0] || "";
        var cursorPos = parseInt(ctx.req.reference[1] || "0", 10);
        var tabCount  = parseInt(ctx.req.reference[2] || "0", 10);

        if (tabCount === 0) {
            // new tab sequence – compute candidates
            var res = get_completions(command, cursorPos, globalThis, directives);
            tabCache.candidates   = res.tab;
            tabCache.replaceStart = cursorPos - res.pos;
            tabCache.replaceEnd   = cursorPos;
            tabCache.ctx          = res.ctx;

            if (res.tab.length === 0) return;

            // insert common prefix on first press
            var common = res.tab[0];
            for (var ci = 1; ci < res.tab.length; ci++) {
                var t = res.tab[ci];
                var j = 0;
                while (j < common.length && j < t.length && common[j] === t[j]) j++;
                common = common.substring(0, j);
            }
            if (common.length > res.pos) {
                // partial completion – insert common prefix
                var newCmd = command.substring(0, tabCache.replaceStart) +
                             common +
                             command.substring(cursorPos);
                var newCur = tabCache.replaceStart + common.length;
                ctx.res.headers["X-SSTP-PassThru-Command"]    = newCmd;
                ctx.res.headers["X-SSTP-PassThru-InsertIndex"] = String(newCur);
                ctx.res.headers["X-SSTP-PassThru-OldInsertIndex"] = String(tabCache.replaceStart);
                return;
            }
            // no common prefix beyond what user typed – fall through to cycling
        }

        // cycle through candidates
        var cands = tabCache.candidates;
        if (cands.length === 0) return;

        var chosen  = cands[tabCount % cands.length];
        var newCmd2 = command.substring(0, tabCache.replaceStart) +
                      chosen +
                      command.substring(tabCache.replaceEnd);
        var newCur2 = tabCache.replaceStart + chosen.length;

        // update replaceEnd so next tab replaces the whole completion
        tabCache.replaceEnd = newCur2;

        ctx.res.headers["X-SSTP-PassThru-Command"]        = newCmd2;
        ctx.res.headers["X-SSTP-PassThru-InsertIndex"]    = String(newCur2);
        ctx.res.headers["X-SSTP-PassThru-OldInsertIndex"] = String(tabCache.replaceStart);
    });

    // ── ShioriEcho.CommandUpdate (syntax highlight) ────────────────

    app.get("ShioriEcho.CommandUpdate", function (ctx) {
        var command = ctx.req.reference[0] || "";
        if (command.length === 0 || !show_colors) return;
        ctx.res.headers["X-SSTP-PassThru-CommandForDisplay"] =
            colorize_to_ansi(command, mexpr, activeStyles);
    });

    // ── ShioriEcho.CommandPrompt ───────────────────────────────────

    app.get("ShioriEcho.CommandPrompt", function (ctx) {
        if (mexpr) {
            ctx.res.headers["X-SSTP-PassThru-Prompt"] = "... ";
        } else {
            ctx.res.headers["X-SSTP-PassThru-Prompt"] = config.prompt || "> ";
        }
    });

    // ── ShioriEcho.CommandComplete ─────────────────────────────────

    app.get("ShioriEcho.CommandComplete", function (ctx) {
        // Attempt single auto-complete when → is pressed at end of line
        var command   = ctx.req.reference[0] || "";
        var cursorPos = parseInt(ctx.req.reference[1] || "0", 10);

        var res = get_completions(command, cursorPos, globalThis, directives);
        if (res.tab.length === 1) {
            var chosen = res.tab[0];
            var start  = cursorPos - res.pos;
            var newCmd = command.substring(0, start) + chosen + command.substring(cursorPos);
            ctx.res.headers["X-SSTP-PassThru-Command"]    = newCmd;
            ctx.res.headers["X-SSTP-PassThru-InsertIndex"] = String(start + chosen.length);
        }
    });

    // ── ShioriEcho.CommandHistory.New ──────────────────────────────

    app.get("ShioriEcho.CommandHistory.New", function () {
        commandHistory.unshift("");
    });

    // ── ShioriEcho.CommandHistory.Update ───────────────────────────

    app.get("ShioriEcho.CommandHistory.Update", function (ctx) {
        var content = ctx.req.reference[0] || "";
        var idx     = parseInt(ctx.req.reference[1] || "0", 10);
        while (commandHistory.length <= idx) commandHistory.push("");
        commandHistory[idx] = content;
    });

    // ── ShioriEcho.CommandHistory.Get ──────────────────────────────

    app.get("ShioriEcho.CommandHistory.Get", function (ctx) {
        var idx = parseInt(ctx.req.reference[0] || "0", 10);
        if (idx >= 0 && idx < commandHistory.length) {
            ctx.res.headers["X-SSTP-PassThru-Command"] = commandHistory[idx];
        }
    });

    // ── ShioriEcho.CommandHistory.ForwardIndex ─────────────────────

    app.get("ShioriEcho.CommandHistory.ForwardIndex", function (ctx) {
        if (commandHistory.length === 0) return;
        var current   = parseInt(ctx.req.reference[0] || "0", 10);
        var increment = parseInt(ctx.req.reference[1] || "1", 10);
        var maxIdx    = commandHistory.length - 1;
        var clamped   = Math.max(0, Math.min(maxIdx, current + increment));
        ctx.res.headers["X-SSTP-PassThru-Index"] = String(clamped);
    });

    // ── Done ──────────────────────────────────────────────────────────

    app.EnvVar.isShioriEchoEnabled = true;
}
