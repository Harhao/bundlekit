import type { IBuildConfig, IBuildEnv } from "../types";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateBuildConfig(config: IBuildConfig, mode: IBuildEnv): ValidationResult {
    const errors: string[] = [];

    if (!config) {
        errors.push("构建配置不能为空");
        return { valid: false, errors };
    }

    const envConfig = (config?.config?.[mode] || config?.config?.development) as Record<string, any>;

    if (!envConfig) {
        errors.push(`未找到环境 "${mode}" 的构建配置`);
        return { valid: false, errors };
    }

    if (!envConfig.entry) {
        errors.push("缺少 entry 字段");
    } else if (typeof envConfig.entry === "object" && Object.keys(envConfig.entry).length === 0) {
        errors.push("entry 对象不能为空");
    }

    if (!envConfig.output) {
        errors.push("缺少 output 字段");
    } else {
        const output = Array.isArray(envConfig.output) ? envConfig.output[0] : envConfig.output;
        if (!output?.dir) errors.push("缺少 output.dir 字段");
        if (!output?.filename) errors.push("缺少 output.filename 字段");
    }

    if (envConfig.pages && Array.isArray(envConfig.pages)) {
        for (let i = 0; i < envConfig.pages.length; i++) {
            if (!envConfig.pages[i].filename) errors.push(`pages[${i}] 缺少 filename`);
            if (!envConfig.pages[i].template) errors.push(`pages[${i}] 缺少 template`);
        }
    }

    // SSR 互斥校验
    if (envConfig.ssr) {
        if (envConfig.target === "node") {
            errors.push("ssr 与 target='node' 互斥：ssr 默认会启用 server pass 时切换到 node target，不要在 envConfig 顶层声明 target='node'");
        }
        if (envConfig.pages && Array.isArray(envConfig.pages) && envConfig.pages.length > 0) {
            errors.push("ssr 暂不支持 pages[] 多页面（第一版仅支持 SPA SSR）");
        }
        if (!envConfig.ssr.entry) {
            errors.push("ssr.entry 不能为空");
        }
        if (!envConfig.ssr.output) {
            errors.push("ssr.output 不能为空");
        } else {
            if (!envConfig.ssr.output.dir) errors.push("缺少 ssr.output.dir");
            if (!envConfig.ssr.output.filename) errors.push("缺少 ssr.output.filename");
            if (!envConfig.ssr.output.formats) errors.push("缺少 ssr.output.formats");
        }
    }

    return { valid: errors.length === 0, errors };
}
