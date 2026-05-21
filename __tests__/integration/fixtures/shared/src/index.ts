/**
 * Library mode 入口：bundler 在 target='node' 时会用这个作为 entry。
 *
 * 导出的 add 函数被集成测试 require 后调用，断言返回值。
 */
export function add(a: number, b: number): number {
    return a + b;
}

export const LIBRARY_MARKER = "__DEVKIT_LIB_MARKER__";

export default { add, LIBRARY_MARKER };
