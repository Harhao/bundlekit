/**
 * utils.ts — 基础工具函数（library 模式 src/index.ts 会 re-export 这里的符号）
 */

export function greet(name: string): string {
    return `Hello, ${name}!`;
}

export function add(a: number, b: number): number {
    return a + b;
}
