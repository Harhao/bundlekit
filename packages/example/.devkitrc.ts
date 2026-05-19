import type { IBuildConfig } from "@devkit/shared-utils";

const pages = [
  {
    filename: "index.html",
    template: "public/index.html",
    entry: "src/index.tsx",
    inject: "body" as const,
  },
];

const config: IBuildConfig = {
  bundler: "webpack",
  mode: "development",
  plugins: ["@devkit/plugin-react", "@devkit/plugin-mock"],
  changeConfigure: (webpackConfig, mode) => {
    if (mode === "production") {
      return {
        ...webpackConfig,
        devtool: false,
      } as any;
    }
    return webpackConfig;
  },
  config: {
    development: {
      target: "web",
      publicPath: "/abv",
      entry: "src/index.tsx",
      pages,
      output: {
        dir: "dist",
        filename: "[name].js",
        formats: "umd",
      },
      alias: {
        "@": "src",
      },
      externals: [],
      js: {
        sourcemap: true,
        minify: false,
        splitChunks: true,
      },
      css: {
        sourcemap: true,
        modules: true,
        extract: true,
        loaders: ["css", "less"],
      },
      devServer: {
        host: "0.0.0.0",
        port: 3000,
        https: false,
        open: true,
        proxy: {
          "/api": {
            target: "http://localhost:4000",
            changeOrigin: true,
            secure: false,
          },
        },
      },
      inject: {
        position: "head",
        js: [
          {
            src: "https://cdn.example.com/init.js",
            defer: true,
          },
        ],
      },
      copy: [
        {
          from: "public/favicon.ico",
          to: "dist",
          ignore: "*.map",
          flatten: true,
        },
      ],
    },
    production: {
      target: "web",
      publicPath: "/abc",
      entry: "src/index.tsx",
      pages,
      output: {
        dir: "dist",
        filename: "[name].[contenthash:8].js",
        formats: "umd",
      },
      alias: {
        "@": "src",
      },
      externals: [],
      js: {
        sourcemap: false,
        minify: true,
        splitChunks: true,
      },
      css: {
        sourcemap: false,
        modules: true,
        extract: true,
        loaders: ["css", "less"],
      },
      analyzer: true,
      devServer: {
        host: "0.0.0.0",
        port: 3000,
        https: false,
        open: false,
        proxy: {},
      },
      inject: {
        position: "body",
      },
    },
    test: {
      target: "web",
      publicPath: "/",
      entry: "src/index.tsx",
      pages,
      output: {
        dir: "dist",
        filename: "[name].js",
        formats: "umd",
      },
      alias: {
        "@": "src",
      },
      externals: [],
      js: {
        sourcemap: true,
        minify: false,
        splitChunks: false,
      },
    },
    staging: {
      target: "web",
      publicPath: "/",
      entry: "src/index.tsx",
      pages,
      output: {
        dir: "dist",
        filename: "[name].[contenthash:8].js",
        formats: "umd",
      },
      alias: {
        "@": "src",
      },
      externals: [],
      js: {
        sourcemap: false,
        minify: true,
        splitChunks: true,
      },
    },
    gray: {
      target: "web",
      publicPath: "/",
      entry: "src/index.tsx",
      pages,
      output: {
        dir: "dist",
        filename: "[name].[contenthash:8].js",
        formats: "umd",
      },
      alias: {
        "@": "src",
      },
      externals: [],
      js: {
        sourcemap: false,
        minify: true,
        splitChunks: true,
      },
    },
  },
};

export default config;
