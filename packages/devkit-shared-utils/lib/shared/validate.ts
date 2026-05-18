import type { IBuildConfig, IBuildEnv } from "../types";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateBuildConfig(config: IBuildConfig, mode: IBuildEnv): ValidationResult {
    const errors: string[] = [];
    const envConfig = (config?.config?.[mode] || config?.config?.development) as Record<string, any>;

    if (!config) {
        errors.push("构建配置不能为空");
        return { valid: false, errors };
    }

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

    return { valid: errors.length === 0, errors };
}
