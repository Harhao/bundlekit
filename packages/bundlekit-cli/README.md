# @bundlekit/cli

前端项目脚手架 CLI，基于 ink 渲染的交互式命令行工具，支持快速创建 BundleKit 项目。

## 安装

```bash
npm install -g @bundlekit/cli
# 或
pnpm add -g @bundlekit/cli
```

## 使用

### 创建新项目

```bash
bc create my-app
```

CLI 会引导你完成以下步骤：

1. 选择模板：`react-ts` / `react-js` / `vue3-ts` / `vue3-js`
2. 选择默认 bundler：`vite` / `webpack` / `rspack` / `rollup` / `rolldown`
3. 输入项目描述（可选）
4. 选择包管理器：`pnpm`（推荐）/ `yarn` / `npm`

### 添加插件或 bundler

```bash
bc add react        # 添加 React 插件
bc add bundler-vite # 添加 Vite bundler 适配器
```

### 命令行选项

```bash
bc create my-app -t react-ts -b vite --pm pnpm
bc add mock --registry https://registry.npmmirror.com
```

| 选项 | 说明 |
|------|------|
| `-t, --template` | 模板类型 |
| `-b, --bundler` | 打包器 |
| `-p, --pm` | 包管理器 |
| `-d, --description` | 项目描述 |
| `--ssr` | 生成 SSR 骨架文件 |
| `--registry` | npm registry 地址 |

## 项目结构

脚手架创建后的项目结构：

```
my-app/
├── .bundlekitrc.ts      # 构建配置文件
├── tsconfig.json        # TypeScript 配置
├── package.json         # 项目依赖
├── src/
│   ├── index.tsx        # 应用入口（CSR）
│   ├── App.tsx          # 根组件
│   └── api/
│       └── index.ts     # HTTP 请求层
├── public/
│   └── index.html       # HTML 模板
└── mock/
    └── db.json          # Mock 数据
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEVKIT_NO_INK` | 禁用 ink TTY 渲染，回退到 enquirer |
| `DEVKIT_SKIP_INSTALL` | 跳过依赖安装 |
| `DEVKIT_NO_PROMPT` | 禁用交互式提示 |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

ISC
