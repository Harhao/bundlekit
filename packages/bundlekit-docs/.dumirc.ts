import { defineConfig } from 'dumi';

export default defineConfig({
    themeConfig: {
        name: 'bundle-bundlekit',
        logo: false,
        nav: [
            { title: '指南', link: '/guide' },
            { title: '配置', link: '/guide/config' },
            { title: 'CLI', link: '/guide/cli' },
            { title: '打包器', link: '/guide/bundlers' },
            { title: '插件', link: '/guide/plugins' },
            { title: '架构设计', link: '/guide/architecture' },
            { title: '贡献', link: '/contributing' },
        ],
        sidebar: {
            '/contributing': [
                {
                    title: '贡献指南',
                    children: [
                        { title: '总览', link: '/contributing' },
                        { title: '环境搭建', link: '/contributing/setup' },
                        { title: '运行测试', link: '/contributing/testing' },
                        { title: '新增 Bundler', link: '/contributing/adding-bundler' },
                        { title: '新增 Plugin', link: '/contributing/adding-plugin' },
                        { title: '发版流程', link: '/contributing/release' },
                    ],
                },
            ],
        },
        footer: 'Open-source MIT Licensed | Copyright © Harhao ',
        socialLinks: {
            github: 'https://github.com/Harhao/bundle-bundlekit',
        },
    },
});
