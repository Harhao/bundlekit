import path from "path";
import { createJiti } from "jiti";
import { FileManager, IBuildConfig, IBuildEnv } from "@devkit/shared-utils";
import { getDefaultConfig } from "./config/defaultConfig";

export default class ConfigLoader {

  private context: string;
  private mode: IBuildEnv;
  private fileManager: FileManager;

  constructor(context: string, mode: IBuildEnv) {
    this.mode = mode;
    this.context = context || process.cwd();
    this.fileManager = new FileManager(context || process.cwd());
  }

  public loadDevkitFileConfig(): IBuildConfig {
    const tsConfigPath = path.resolve(this.context, ".devkitrc.ts");
    const jsConfigPath = path.resolve(this.context, ".devkitrc.js");

    const configPath = this.fileManager.isFilePathExist(tsConfigPath)
      ? tsConfigPath
      : this.fileManager.isFilePathExist(jsConfigPath)
        ? jsConfigPath
        : null;

    if (!configPath) {
      throw new Error(
        `未找到配置文件 .devkitrc.ts 或 .devkitrc.js，请在项目根目录 ${this.context} 下创建配置文件`
      );
    }

    const jiti = createJiti(import.meta.url, {
      alias: { "@": path.resolve(this.context, "src") },
    });

    const userConfig = jiti(configPath) as { default?: IBuildConfig };
    return (userConfig.default || userConfig) as IBuildConfig;
  }

  private deepMerge(defaults: Record<string, any>, overrides: Record<string, any>): Record<string, any> {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      const overrideVal = overrides[key];
      const defaultVal = defaults[key];
      if (
        overrideVal &&
        typeof overrideVal === "object" &&
        !Array.isArray(overrideVal) &&
        defaultVal &&
        typeof defaultVal === "object" &&
        !Array.isArray(defaultVal)
      ) {
        result[key] = this.deepMerge(defaultVal, overrideVal);
      } else {
        result[key] = overrideVal;
      }
    }
    return result;
  }

  private resolvePaths(config: IBuildConfig): IBuildConfig {
    const resolveDir = (dir: string) =>
      path.isAbsolute(dir) ? dir : path.resolve(this.context, dir);

    const resolved = { ...config, config: { ...config.config } as IBuildConfig["config"] };

    for (const env of Object.keys(resolved.config || {})) {
      const envConfig = { ...resolved.config[env] };
      if (envConfig.entry) {
        if (typeof envConfig.entry === "string") {
          envConfig.entry = resolveDir(envConfig.entry);
        } else if (Array.isArray(envConfig.entry)) {
          envConfig.entry = (envConfig.entry as string[]).map(resolveDir);
        } else if (typeof envConfig.entry === "object") {
          const resolved: Record<string, string> = {};
          for (const [key, val] of Object.entries(envConfig.entry as Record<string, string>)) {
            resolved[key] = resolveDir(val);
          }
          envConfig.entry = resolved;
        }
      }
      if (envConfig.output) {
        const output = Array.isArray(envConfig.output) ? envConfig.output : [envConfig.output];
        const resolvedOutputs = output.map((o) => ({
          ...o,
          dir: resolveDir(o.dir),
        }));
        envConfig.output = Array.isArray(envConfig.output) ? resolvedOutputs : resolvedOutputs[0];
      }
      if (envConfig.alias) {
        const resolvedAlias: Record<string, string> = {};
        for (const [key, val] of Object.entries(envConfig.alias)) {
          resolvedAlias[key] = resolveDir(String(val));
        }
        envConfig.alias = resolvedAlias;
      }
      resolved.config[env] = envConfig;
    }
    return resolved;
  }

  public async resolveAllConfig(): Promise<IBuildConfig> {
    const defaultConfig = getDefaultConfig(this.context);
    const userConfig = this.loadDevkitFileConfig();
    const merged = this.deepMerge(defaultConfig as any, userConfig as any) as IBuildConfig;
    return this.resolvePaths(merged);
  }
}
