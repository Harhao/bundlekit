import fs from "fs";
import path from "path";

/**
 * 在 .devkitrc.ts / .devkitrc.js 的 plugins[] 数组中追加一个插件名。
 *
 * 处理三种情况：
 *  1. plugins: ["a"] → plugins: ["a", "newPlugin"]
 *  2. plugins: []    → plugins: ["newPlugin"]
 *  3. plugins 字段不存在 → 在顶层对象第一个属性前插入 plugins: ["newPlugin"],
 */
export function addPluginToConfig(context: string, pluginName: string): void {
    const tsPath = path.resolve(context, ".devkitrc.ts");
    const jsPath = path.resolve(context, ".devkitrc.js");

    const configPath = fs.existsSync(tsPath) ? tsPath
        : fs.existsSync(jsPath) ? jsPath
        : null;

    if (!configPath) {
        throw new Error(`未找到 .devkitrc.ts 或 .devkitrc.js，请在 ${context} 下创建配置文件`);
    }

    let content = fs.readFileSync(configPath, "utf-8");

    // 已存在该插件，跳过
    if (content.includes(`"${pluginName}"`) || content.includes(`'${pluginName}'`)) {
        return;
    }

    // 情况 1/2：plugins 字段已存在
    const pluginsReg = /(plugins\s*:\s*\[)([^\]]*?)(\])/s;
    if (pluginsReg.test(content)) {
        content = content.replace(pluginsReg, (_, open, inner, close) => {
            const trimmed = inner.trim();
            if (trimmed === "") {
                return `${open}"${pluginName}"${close}`;
            }
            // 去掉末尾多余逗号后追加
            const cleaned = trimmed.replace(/,\s*$/, "");
            return `${open}${cleaned}, "${pluginName}"${close}`;
        });
        fs.writeFileSync(configPath, content, "utf-8");
        return;
    }

    // 情况 3：plugins 字段不存在，在 bundler: 行后插入
    // 兼容 bundler: "webpack" 和 bundler: "webpack" as const 两种写法
    const bundlerReg = /(bundler\s*:\s*["'][^"']+["'][^,\n]*,?\n)/;
    if (bundlerReg.test(content)) {
        content = content.replace(bundlerReg, (match) => {
            const comma = match.trimEnd().endsWith(",") ? "" : ",";
            return `${match.trimEnd()}${comma}\n  plugins: ["${pluginName}"],\n`;
        });
        fs.writeFileSync(configPath, content, "utf-8");
        return;
    }

    throw new Error(`无法解析 ${configPath} 的结构，请手动将 "${pluginName}" 添加到 plugins 数组`);
}
