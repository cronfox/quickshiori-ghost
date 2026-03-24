/**
 * SakuraScriptBuilder - 用于构建符合规范的 Sakura Script
 * 
 * 提供流畅的链式 API 来构建 Sakura Script，用于传递给 SSP 等前端程序
 */
export class SakuraScriptBuilder {
  constructor() {
    this.script = '';
    this.autoEscape = true; // 默认启用自动转义
  }

  /**
   * 获取当前构建的脚本
   */
  toString() {
    return this.script;
  }

  /**
   * 添加原始文本
   * @param {string} text 要添加的文本
   * @param {boolean} [escape=true] 是否自动转义，默认遵循当前autoEscape设置
   */
  text(text, escape) {
    if (escape === undefined ? this.autoEscape : escape) {
      text = this.escapeText(text);
    }
    this.script += text;
    return this;
  }

  /**
   * 转义Sakura Script文本
   * @param {string} text 需要转义的文本
   * @param {boolean} [inFunction=false] 是否在函数内
   * @param {boolean} [inParam=false] 是否在参数内
   * @returns {string} 转义后的文本
   */
  escapeText(text, inFunction = false, inParam = false) {
    /*
    さくらスクリプトのエスケープ
    「\」をさくらスクリプトの開始記号でなく単に表示したい場合は「\\」とする
    同様に環境変数埋め込みタグの「%」は「\%」と書く
    スクウェアブラケット内に引数を持つタグ（\q[ラベル名,ID]など）内でのみ、「]」は「\]」と書ける。
    スクウェアブラケット内に複数の引数を持つタグの第２引数以降で、「,」を引数の内容としたい場合、その引数全体を""で囲うことで全体を一つの引数として扱える。
    例：\![raise,OnTest,"100,2"]
    同様に「"」を引数の内容としたい場合、その引数全体を""で囲った上で"を二重にする。
    例：\![call,ghost,"the ""MobileMaster"""]
    */
    // 处理转义字符
    text = String(text).replace(/\\/g, '\\\\');
    text = text.replace(/%/g, '\\%');

    if (inFunction && inParam) {
      // 在函数参数中处理方括号右括号转义
      text = text.replace(/]/g, '\\]');

      // 处理参数中的逗号和双引号
      if (text.includes(',') || text.includes('"')) {
        // 如果参数中包含双引号，先将所有双引号加倍
        text = text.replace(/"/g, '""');
        // 用双引号将整个参数包裹起来
        text = `"${text}"`;
      }
    }

    return text;
  }

  /**
   * 设置是否自动转义文本
   * @param {boolean} enable 是否启用自动转义
   */
  setAutoEscape(enable) {
    this.autoEscape = !!enable;
    return this;
  }

  /**
   * 清空当前脚本
   */
  clear() {
    this.script = '';
    return this;
  }

  // === 作用域命令 ===

  /**
   * 切换到本体侧
   */
  scope(id) {
    if (id === '0') {
      this.script += '\\0';
    } else if (id === '1') {
      this.script += '\\1';
    } else {
      this.script += `\\p[${id}]`;
    }
    return this;
  }


  // === 表面命令 ===

  /**
   * 更改当前作用域的表面ID
   */
  surface(id) {
    this.script += `\\s[${id}]`;
    return this;
  }

  /**
   * 在当前作用域显示表面动画
   */
  surfaceAnim(id) {
    this.script += `\\i[${id}]`;
    return this;
  }

  /**
   * 在当前作用域显示表面动画并等待完成
   */
  surfaceAnimWait(id) {
    this.script += `\\i[${id},wait]`;
    return this;
  }

  /**
   * 清除指定ID的表面动画
   */
  clearAnim(id) {
    this.script += `\\![anim,clear,${id}]`;
    return this;
  }

  /**
   * 暂停指定ID的表面动画
   */
  pauseAnim(id) {
    this.script += `\\![anim,pause,${id}]`;
    return this;
  }

  /**
   * 恢复指定ID的表面动画
   */
  resumeAnim(id) {
    this.script += `\\![anim,resume,${id}]`;
    return this;
  }

  /**
   * 设置指定ID的表面动画偏移
   */
  offsetAnim(id, x, y) {
    this.script += `\\![anim,offset,${id},${x},${y}]`;
    return this;
  }

  /**
   * 设置当前位置相对于桌面的吸附方式
   */
  setAlignmentToDesktop(alignment) {
    this.script += `\\![set,alignmenttodesktop,${alignment}]`;
    return this;
  }

  /**
   * 设置表面缩放比例
   */
  setScaling(scale) {
    this.script += `\\![set,scaling,${scale}]`;
    return this;
  }

  /**
   * 设置表面水平和垂直缩放比例
   */
  setScalingXY(xScale, yScale) {
    this.script += `\\![set,scaling,${xScale},${yScale}]`;
    return this;
  }

  /**
   * 设置表面透明度
   */
  setAlpha(alpha) {
    this.script += `\\![set,alpha,${alpha}]`;
    return this;
  }

  /**
   * 当前角色远离另一角色一定距离
   */
  moveAway() {
    this.script += '\\4';
    return this;
  }

  /**
   * 当前角色靠近另一角色
   */
  moveClose() {
    this.script += '\\5';
    return this;
  }

  /**
   * 移动到指定坐标
   */
  move(x, y, duration = 0, base = 'screen') {
    this.script += `\\![move,--X=${x},--Y=${y},--time=${duration},--base=${base}]`;
    return this;
  }

  /**
   * 异步移动到指定坐标
   */
  moveAsync(x, y, duration = 0, base = 'screen') {
    this.script += `\\![moveasync,--X=${x},--Y=${y},--time=${duration},--base=${base}]`;
    return this;
  }

  // === 气泡命令 ===

  /**
   * 更改当前作用域的气泡ID
   */
  balloon(id) {
    this.script += `\\b[${id}]`;
    return this;
  }

  /**
   * 在气泡中添加图片
   */
  balloonImage(path, x, y, ...options) {
    if (options.length > 0) {
      this.script += `\\_b[${path},${x},${y},${options.join(',')}]`;
    } else {
      this.script += `\\_b[${path},${x},${y}]`;
    }
    return this;
  }

  /**
   * 在气泡文本行内添加图片
   */
  balloonInlineImage(path, ...options) {
    if (options.length > 0) {
      this.script += `\\_b[${path},inline,${options.join(',')}]`;
    } else {
      this.script += `\\_b[${path},inline]`;
    }
    return this;
  }

  /**
   * 换行
   */
  newLine() {
    this.script += '\\n';
    return this;
  }

  /**
   * 半高度换行
   */
  halfLine() {
    this.script += '\\n[half]';
    return this;
  }

  /**
   * 指定百分比高度换行
   */
  percentLine(percent) {
    this.script += `\\n[${percent}]`;
    return this;
  }

  /**
   * 禁止自动换行
   */
  noAutoLineBreak() {
    this.script += '\\_n';
    return this;
  }

  /**
   * 清除当前气泡文字
   */
  clearBalloon() {
    this.script += '\\c';
    return this;
  }

  /**
   * 从当前位置清除指定字符数
   */
  clearChars(count) {
    this.script += `\\c[char,${count}]`;
    return this;
  }

  /**
   * 从指定位置清除指定字符数
   */
  clearCharsFrom(count, position) {
    this.script += `\\c[char,${count},${position}]`;
    return this;
  }

  /**
   * 从当前位置清除指定行数
   */
  clearLines(count) {
    this.script += `\\c[line,${count}]`;
    return this;
  }

  /**
   * 从指定位置清除指定行数
   */
  clearLinesFrom(count, position) {
    this.script += `\\c[line,${count},${position}]`;
    return this;
  }

  /**
   * 移动光标到指定位置
   */
  locate(x, y) {
    this.script += `\\_l[${x},${y}]`;
    return this;
  }

  /**
   * 在上一个气泡继续添加文本
   */
  continueText() {
    this.script += '\\C';
    return this;
  }

  /**
   * 设置气泡自动滚动
   */
  setAutoscroll(enable) {
    this.script += `\\![set,autoscroll,${enable ? 'enable' : 'disable'}]`;
    return this;
  }

  /**
   * 设置气泡偏移
   */
  setBalloonOffset(x, y) {
    this.script += `\\![set,balloonoffset,${x},${y}]`;
    return this;
  }

  /**
   * 设置气泡对齐方式
   */
  setBalloonAlign(alignment) {
    this.script += `\\![set,balloonalign,${alignment}]`;
    return this;
  }

  /**
   * 设置气泡标记
   */
  setBalloonMarker(marker = '') {
    this.script += `\\![set,balloonmarker,${marker}]`;
    return this;
  }

  /**
   * 设置气泡超时时间
   */
  setBalloonTimeout(time) {
    this.script += `\\![set,balloontimeout,${time}]`;
    return this;
  }

  /**
   * 设置气泡文字流动速度
   */
  setBalloonWait(speed) {
    this.script += `\\![set,balloonwait,${speed}]`;
    return this;
  }

  /**
   * 显示气泡标记
   */
  marker() {
    this.script += '\\![*]';
    return this;
  }

  // === 文字变更命令 ===

  /**
   * 设置文本对齐方式
   */
  setAlign(alignment) {
    this.script += `\\f[align,${alignment}]`;
    return this;
  }

  /**
   * 设置垂直对齐方式
   */
  setVAlign(alignment) {
    this.script += `\\f[valign,${alignment}]`;
    return this;
  }

  /**
   * 设置字体
   */
  setFont(fontName) {
    this.script += `\\f[name,${fontName}]`;
    return this;
  }

  /**
   * 设置字体大小
   */
  setFontSize(size) {
    this.script += `\\f[height,${size}]`;
    return this;
  }

  /**
   * 设置字体颜色
   */
  setFontColor(color) {
    this.script += `\\f[color,${color}]`;
    return this;
  }

  /**
   * 设置阴影颜色
   */
  setShadowColor(color) {
    this.script += `\\f[shadowcolor,${color}]`;
    return this;
  }

  /**
   * 禁用阴影
   */
  disableShadow() {
    this.script += '\\f[shadowcolor,none]';
    return this;
  }

  /**
   * 设置阴影样式
   */
  setShadowStyle(style) {
    this.script += `\\f[shadowstyle,${style}]`;
    return this;
  }

  /**
   * 设置轮廓
   */
  setOutline(param) {
    this.script += `\\f[outline,${param}]`;
    return this;
  }

  /**
   * 设置粗体
   */
  setBold(param) {
    this.script += `\\f[bold,${param}]`;
    return this;
  }

  /**
   * 设置斜体
   */
  setItalic(param) {
    this.script += `\\f[italic,${param}]`;
    return this;
  }

  /**
   * 设置删除线
   */
  setStrike(param) {
    this.script += `\\f[strike,${param}]`;
    return this;
  }

  /**
   * 设置下划线
   */
  setUnderline(param) {
    this.script += `\\f[underline,${param}]`;
    return this;
  }

  /**
   * 重置所有字体设置为默认
   */
  resetFont() {
    this.script += '\\f[default]';
    return this;
  }

  // === 等待命令 ===

  /**
   * 等待指定时间（1-9单位，每单位约50ms）
   */
  wait(time) {
    this.script += `\\w${time}`;
    return this;
  }

  /**
   * 精确等待指定毫秒
   */
  waitMs(ms) {
    this.script += `\\_w[${ms}]`;
    return this;
  }

  /**
   * 从脚本开始执行等待指定毫秒
   */
  waitAbsolute(ms) {
    this.script += `\\__w[${ms}]`;
    return this;
  }

  /**
   * 等待用户点击
   */
  waitClick() {
    this.script += '\\x';
    return this;
  }

  /**
   * 等待用户点击但不清除内容
   */
  waitClickNoClear() {
    this.script += '\\x[noclear]';
    return this;
  }

  /**
   * 开始时间临界区
   */
  timeCritical() {
    this.script += '\\t';
    return this;
  }

  /**
   * 开始快速显示区域
   */
  quickSection() {
    this.script += '\\_q';
    return this;
  }

  /**
   * 开始或关闭快速显示区域
   */
  setQuickSection(enable) {
    this.script += `\\![quicksection,${enable ? 'true' : 'false'}]`;
    return this;
  }

  /**
   * 开始同步区域
   */
  syncSection() {
    this.script += '\\_s';
    return this;
  }

  // === 选择命令 ===

  /**
   * 添加选择项
   */
  choice(title, id, ...references) {
    const escapedTitle = this.autoEscape ? this.escapeText(title, true, true) : title;
    if (references.length > 0) {
      const escapedRefs = references.map(ref => this.autoEscape ? this.escapeText(ref, true, true) : ref);
      this.script += `\\q[${escapedTitle},${id},${escapedRefs.join(',')}]`;
    } else {
      this.script += `\\q[${escapedTitle},${id}]`;
    }
    return this;
  }

  /**
   * 添加脚本选择项
   */
  scriptChoice(title, script) {
    const escapedTitle = this.autoEscape ? this.escapeText(title, true, true) : title;
    // const escapedScript = this.autoEscape ? this.escapeText(script, false, true) : script;
    this.script += `\\q[${escapedTitle},script:"${script}"]`;
    return this;
  }

  /**
   * 禁止选择超时
   */
  noChoiceTimeout() {
    this.script += '\\*';
    return this;
  }

  /**
   * 设置选择超时
   */
  setChoiceTimeout(time) {
    this.script += `\\![set,choicetimeout,${time}]`;
    return this;
  }

  /**
   * 添加锚链接
   */
  anchor(text, id, ...references) {
    const escapedText = this.autoEscape ? this.escapeText(text) : text;
    const refsText = references.length > 0 ?
      ',' + references.map(ref => this.autoEscape ? this.escapeText(ref, true, true) : ref).join(',') :
      '';
    this.script += `\\_a[${id}${refsText}]${escapedText}\\_a`;
    return this;
  }

  // === 事件命令 ===

  /**
   * 结束事件
   */
  end() {
    this.script += '\\e';
    return this;
  }

  /**
   * 结束ghost
   */
  close() {
    this.script += '\\-';
    return this;
  }

  /**
   * 说随机对话
   */
  aitalk() {
    this.script += '\\a';
    return this;
  }

  /**
   * 检查自身网络更新
   */
  updateSelf(...options) {
    if (options.length > 0) {
      this.script += `\\![updatebymyself,${options.join(',')}]`;
    } else {
      this.script += '\\![updatebymyself]';
    }
    return this;
  }

  /**
   * 执行指定事件
   */
  raiseEvent(eventName, ...references) {
    if (references.length > 0) {
      this.script += `\\![raise,${eventName},${references.join(',')}]`;
    } else {
      this.script += `\\![raise,${eventName}]`;
    }
    return this;
  }

  /**
   * 嵌入指定事件结果
   */
  embedEvent(eventName, ...references) {
    if (references.length > 0) {
      this.script += `\\![embed,${eventName},${references.join(',')}]`;
    } else {
      this.script += `\\![embed,${eventName}]`;
    }
    return this;
  }

  /**
   * 定时执行事件
   */
  timerRaise(time, repeat, eventName, ...references) {
    if (references.length > 0) {
      this.script += `\\![timerraise,${time},${repeat ? '0' : '1'},${eventName},${references.join(',')}]`;
    } else {
      this.script += `\\![timerraise,${time},${repeat ? '0' : '1'},${eventName}]`;
    }
    return this;
  }

  // === 声音命令 ===

  /**
   * 播放声音
   */
  playSound(path, ...options) {
    if (options.length > 0) {
      this.script += `\\![sound,play,${path},${options.join(',')}]`;
    } else {
      this.script += `\\![sound,play,${path}]`;
    }
    return this;
  }

  /**
   * 预加载声音
   */
  loadSound(path, ...options) {
    if (options.length > 0) {
      this.script += `\\![sound,load,${path},${options.join(',')}]`;
    } else {
      this.script += `\\![sound,load,${path}]`;
    }
    return this;
  }

  /**
   * 循环播放声音
   */
  loopSound(path) {
    this.script += `\\![sound,loop,${path}]`;
    return this;
  }

  /**
   * 等待声音播放完成
   */
  waitSound() {
    this.script += '\\![sound,wait]';
    return this;
  }

  /**
   * 暂停声音
   */
  pauseSound(path = '') {
    this.script += `\\![sound,pause,${path}]`;
    return this;
  }

  /**
   * 恢复声音
   */
  resumeSound(path = '') {
    this.script += `\\![sound,resume,${path}]`;
    return this;
  }

  /**
   * 停止声音
   */
  stopSound(path = '') {
    this.script += `\\![sound,stop,${path}]`;
    return this;
  }

  // === 打开命令 ===

  /**
   * 跳转到URL或文件
   */
  jump(id) {
    this.script += `\\j[${id}]`;
    return this;
  }

  /**
   * 打开浏览器
   */
  openBrowser(url) {
    this.script += `\\![open,browser,${url}]`;
    return this;
  }

  /**
   * 打开教学框
   */
  openTeachbox() {
    this.script += '\\![open,teachbox]';
    return this;
  }

  /**
   * 关闭教学框
   */
  closeTeachbox() {
    this.script += '\\![close,teachbox]';
    return this;
  }

  /**
   * 打开通信框
   */
  openCommunicatebox(defaultText = '', ...options) {
    if (options.length > 0) {
      this.script += `\\![open,communicatebox,${defaultText},${options.join(',')}]`;
    } else if (defaultText) {
      this.script += `\\![open,communicatebox,${defaultText}]`;
    } else {
      this.script += '\\![open,communicatebox]';
    }
    return this;
  }

  /**
   * 关闭通信框
   */
  closeCommunicatebox() {
    this.script += '\\![close,communicatebox]';
    return this;
  }

  /**
   * 打开输入框
   */
  openInputbox(id, timeout, text, ...options) {
    if (options.length > 0) {
      this.script += `\\![open,inputbox,${id},${timeout},${text},${options.join(',')}]`;
    } else {
      this.script += `\\![open,inputbox,${id},${timeout},${text}]`;
    }
    return this;
  }

  // === 属性系统操作命令 ===
  /**
   * 插入环境变量
   */
  insertEnv(name) {
    this.script += `%${name}`;
    return this;
  }
  insertProperty(name) {
    this.script += `%property${name}`;
    return this;
  }
  /**
   * 设置属性
   */
  setProperty(name, value) {
    const escapedValue = this.autoEscape ? this.escapeText(value, true, true) : value;
    this.script += `\\![set,property,${name},${escapedValue}]`;
    return this;
  }

  /**
   * 获取属性
   */
  getProperty(eventName, ...propertyNames) {
    this.script += `\\![get,property,${eventName},${propertyNames.join(',')}]`;
    return this;
  }


  // === HTTP命令 ===

  /**
   * HTTP GET请求
   */
  httpGet(url, ...options) {
    if (options.length > 0) {
      this.script += `\\![execute,http-get,${url},${options.join(',')}]`;
    } else {
      this.script += `\\![execute,http-get,${url}]`;
    }
    return this;
  }

  /**
   * HTTP POST请求
   */
  httpPost(url, ...options) {
    if (options.length > 0) {
      this.script += `\\![execute,http-post,${url},${options.join(',')}]`;
    } else {
      this.script += `\\![execute,http-post,${url}]`;
    }
    return this;
  }

  // === 模式命令 ===

  /**
   * 进入被动模式
   */
  enterPassiveMode() {
    this.script += '\\![enter,passivemode]';
    return this;
  }

  /**
   * 离开被动模式
   */
  leavePassiveMode() {
    this.script += '\\![leave,passivemode]';
    return this;
  }

  /**
   * 进入诱导模式
   */
  enterInductionMode() {
    this.script += '\\![enter,inductionmode]';
    return this;
  }

  /**
   * 离开诱导模式
   */
  leaveInductionMode() {
    this.script += '\\![leave,inductionmode]';
    return this;
  }

  /**
   * 进入选择模式
   */
  enterSelectMode(mode = 'rect', ...params) {
    if (params.length > 0) {
      this.script += `\\![enter,selectmode,${mode},${params.join(',')}]`;
    } else {
      this.script += `\\![enter,selectmode,${mode}]`;
    }
    return this;
  }

  /**
   * 离开选择模式
   */
  leaveSelectMode() {
    this.script += '\\![leave,selectmode]';
    return this;
  }

  // === 其他常用命令 ===

  /**
   * 切换Ghost
   */
  changeGhost(ghostName, option = '') {
    if (option) {
      this.script += `\\![change,ghost,${ghostName},${option}]`;
    } else {
      this.script += `\\![change,ghost,${ghostName}]`;
    }
    return this;
  }

  /**
   * 切换Shell
   */
  changeShell(shellName, option = '') {
    if (option) {
      this.script += `\\![change,shell,${shellName},${option}]`;
    } else {
      this.script += `\\![change,shell,${shellName}]`;
    }
    return this;
  }

  /**
   * 切换气泡
   */
  changeBalloon(balloonName) {
    this.script += `\\![change,balloon,${balloonName}]`;
    return this;
  }

  /**
   * 调用其他Ghost
   */
  callGhost(ghostName, option = '') {
    if (option) {
      this.script += `\\![call,ghost,${ghostName},${option}]`;
    } else {
      this.script += `\\![call,ghost,${ghostName}]`;
    }
    return this;
  }

  /**
   * 重新加载Shell
   */
  reloadShell() {
    this.script += '\\![reload,shell]';
    return this;
  }

  /**
   * 重新加载Ghost
   */
  reloadGhost() {
    this.script += '\\![reload,ghost]';
    return this;
  }

  reload(...param) {
    this.script += `\\![reload,${param.join(',')}]`;
    return this;
  }
  unload(...param) {
    this.script += `\\![unload,${param.join(',')}]`;
    return this;
  }
  load(...param) {
    this.script += `\\![load,${param.join(',')}]`;
    return this;
  }

  /**
   * rawScript
   */
  rawScript(command) {
    this.script += command;
    return this;
  }

  /**
   * \\_u[0x0000]
   * @param {Number} unicode 
   */
  insertUnicode(unicode) {
    this.script += `\\_u[0x${unicode.toString(16).padStart(4, '0')}]`;
    return this;
  }

  /**
   * \\![command,param1,param2,...]
   * @param {String} command 
   * @param  {...any} params
   */
  executeBangCommand(command, ...params) {
    // 对指令名称进行基础转义（通常指令名不含特殊字符，但为了安全处理）
    const cmd = this.autoEscape ? this.escapeText(command, true, false) : command;

    // 对每一个参数应用参数级转义规则：
    // 1. 转义 \ 和 %
    // 2. 将 ] 转义为 \]
    // 3. 处理逗号和双引号（自动加双引号包裹或双倍引号）
    const escapedParams = params.map(p =>
      this.autoEscape ? this.escapeText(p, true, true) : p
    );

    const paramString = escapedParams.length > 0 ? `,${escapedParams.join(',')}` : '';
    this.script += `\\![${cmd}${paramString}]`;
    return this;
  }
}

// 创建一个简易的快速访问函数
export function sakuraScript() {
  return new SakuraScriptBuilder();
}

// 为了向下兼容，也导出默认对象
export default {
  SakuraScriptBuilder,
  sakuraScript
};

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  // 在 CommonJS 环境下（Node.js）
  module.exports = { SakuraScriptBuilder, sakuraScript };
}