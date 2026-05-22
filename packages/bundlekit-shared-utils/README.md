# @bundlekit/shared-utils

BundleKit 共享工具库，提供通用工具函数、类型定义和配置管理。

## 安装

```bash
npm install @bundlekit/shared-utils
# 或
pnpm add @bundlekit/shared-utils
```

## 功能特性

### 工具函数

- **FileManager** - 文件系统操作封装
- **Logger** - 彩色日志输出
- **Spinner** - 加载动画
- **PackageManager** - 包管理器抽象
- **confirm()** - 交互式确认提示
- **validateBuildConfig()** - 配置校验

### SSR 支持

- **createSSRRequestHandler()** - SSR 渲染中间件
- **buildSSRView()** - SSR 视图转换
- **resolveSSRExternals()** - externals 解析

### HTTP 客户端

- **Fetch** - 基于 Node http/https 的 HTTP 客户端

### 配置工具

- **addPluginToConfig()** - 自动修改 .bundlekitrc.ts
- **resolveBundlerName()** - bundler 名称解析
- **BUNDLER_PACKAGE_MAP** - bundler 名称映射

## 类型定义

```typescript
import type {
  IBuildConfig,
  IEnvBuildConfig,
  ISSRConfig,
  IToolsHooks,
  IDepMode,
  IGeneratorAPI,
} from '@bundlekit/shared-utils';
```

### IBuildConfig

```typescript
interface IBuildConfig {
  config: {
    development?: IEnvBuildConfig;
    production?: IEnvBuildConfig;
    staging?: IEnvBuildConfig;
  };
  plugins?: string[];
  tools?: IToolsHooks;
}
```

### IEnvBuildConfig

```typescript
interface IEnvBuildConfig {
  entry: string;
  output: {
    dir: string;
    filename: string;
    formats?: 'esm' | 'commonjs' | 'umd' | 'iife';
  };
  framework?: string;
  minify?: boolean;
  sourcemap?: boolean;
  ssr?: ISSRConfig;
  library?: boolean;
  libraryName?: string;
}
```

## 使用示例

```typescript
import { FileManager, Logger, validateBuildConfig } from '@bundlekit/shared-utils';

const fm = new FileManager(process.cwd());
const logger = new Logger();

// 检查文件是否存在
if (fm.isFilePathExist('src/index.ts')) {
  logger.info('找到入口文件');
}

// 校验配置
const config = { config: { production: { entry: 'src/index.ts' } } };
const isValid = validateBuildConfig(config);
```

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
