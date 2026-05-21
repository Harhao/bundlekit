// 该文件历史上保存 buildSSRView / resolveSSRExternals。
// 为避免 bundler-* 间重复，本仓库已把这些工具迁移至 @devkit/shared-utils。
// 这里仅 re-export 以保持向后兼容。
export { buildSSRView, resolveSSRExternals } from "@devkit/shared-utils";
export type { SSRExternalsResolver } from "@devkit/shared-utils";
