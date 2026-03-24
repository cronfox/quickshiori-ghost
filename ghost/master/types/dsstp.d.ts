/*
 * Copyright (c) 2026 Cronfox
 * All rights reserved.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

declare module 'dsstp' {
    /**
     * 发送 Direct SSTP 请求到目标 Ghost。
     *
     * 使用 WM_COPYDATA 消息与目标窗口通信。
     * 目标 HWND 通常从 ukafmo 模块的 FMO 数据中获取。
     *
     * @param hWnd - 目标 Ghost 的窗口句柄（HWND 的十进制整数）
     * @param request - SSTP 请求字符串（需包含完整的 SSTP 协议头）
     * @param timeout - 超时时间（毫秒），默认 500
     * @returns SSTP 响应字符串，超时或失败时返回 null
     *
     * @example
     * ```js
     * import dsstp from 'dsstp.dll';
     * import ukafmo from 'ukafmo.dll';
     *
     * // 从 FMO 获取目标 Ghost 的 HWND
     * const fmo = ukafmo.readFMO();
     * const ghost = fmo.find(g => g.hwnd);
     * const hWnd = parseInt(ghost.hwnd);
     *
     * // 构造 SSTP 请求
     * const request = [
     *   'SEND SSTP/1.4',
     *   'Charset: UTF-8',
     *   'Sender: MyApp',
     *   'Script: \\h\\s[0]Hello!\\e',
     *   '',
     *   ''
     * ].join('\r\n');
     *
     * // 发送并获取响应
     * const response = dsstp.send(hWnd, request);
     * if (response) {
     *   console.log('Response:', response);
     * }
     * ```
     */
    export function send(hWnd: number, request: string, timeout?: number): string | null;

    /**
     * 显式销毁内部接收窗口。
     *
     * 通常不需要调用此函数，模块卸载时会自动清理。
     * 仅在需要立即释放资源时使用。
     */
    export function destroy(): void;
}

declare module 'dsstp.dll' {
    export * from 'dsstp';
}
