# @bundlekit/plugin-angular

Angular 构建插件，为 BundleKit 提供 Angular 17+ standalone 项目模板和构建支持。

## 安装

```bash
npm install -D @bundlekit/plugin-angular
# 或
pnpm add -D @bundlekit/plugin-angular
```

## 使用

### 自动配置

在 `@bundlekit/cli` 创建项目时选择 Angular 模板，插件会自动配置：

```bash
bc create my-app -t angular-ts
```

### 手动配置

在 `.bundlekitrc.ts` 中添加插件：

```typescript
export default defineConfig({
  plugins: ['@bundlekit/plugin-angular'],
});
```

## 功能特性

- ✅ Angular 17+ standalone components 支持
- ✅ TypeScript / JavaScript 模板
- ✅ 装饰器 + 装饰器元数据自动配置
- ✅ AOT 模板编译（vite / webpack / rspack / rollup / rolldown）
- ✅ JIT fallback（esbuild / parcel，标注实验性）
- ✅ SSR 支持（`@angular/platform-server` + `provideClientHydration`）

## 模板选项

| 模板 | 说明 |
|------|------|
| `angular-ts` | Angular 17 + TypeScript（推荐） |
| `angular-js` | Angular 17 + JavaScript（需 babel 装饰器插件） |

## 生成的项目结构

```
my-app/
├── src/
│   ├── main.ts              # CSR 应用入口
│   ├── entry-client.ts      # SSR 客户端入口（可选）
│   ├── entry-server.ts      # SSR 服务端入口（可选）
│   └── app/
│       ├── app.component.ts # 根组件（standalone）
│       ├── app.config.ts    # ApplicationConfig
│       └── app.config.server.ts  # SSR 专用配置（可选）
├── public/
│   └── index.html           # HTML 模板（含 <app-root> 占位）
└── .bundlekitrc.ts          # 构建配置
```

## SSR 支持

创建 SSR 项目：

```bash
bc create my-app -t angular-ts --ssr
```

生成的 `entry-server.ts` 使用 `renderApplication` 异步 API：

```typescript
import 'zone.js/node';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { renderApplication } from '@angular/platform-server';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

export async function render(url: string): Promise<string> {
  const bootstrap = () => bootstrapApplication(AppComponent, config);
  return renderApplication(bootstrap, { document: TEMPLATE, url });
}
```

## Bundler 支持矩阵

| Bundler  | SPA build | SSR build | dev SSR | 备注 |
|----------|-----------|-----------|---------|------|
| vite     | ✅ | ✅ | ✅ | `@analogjs/vite-plugin-angular` |
| webpack  | ✅ | ✅ | ✅ | `@ngtools/webpack` |
| rspack   | ✅ | ✅ | ✅ | `@ngtools/webpack` + SWC 装饰器（fallback：JIT） |
| rollup   | ✅ | ✅ | ✅ | `@analogjs/vite-plugin-angular`（rollup-API 兼容） |
| rolldown | ✅ | ✅ | ✅ | 同 rollup |
| esbuild  | ⚠️ JIT only | ❌ | ❌ | 实验性，不做 AOT |
| parcel   | ⚠️ JIT only | ❌ | ❌ | 实验性 |

## 文档

完整文档请访问 [https://bundlekit.harhao.workers.dev](https://bundlekit.harhao.workers.dev)

## License

MIT
