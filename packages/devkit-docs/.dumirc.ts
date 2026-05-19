import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    name: 'bundle-devkit',
    logo: false,
    nav: [
      { title: '指南', link: '/guide' },
      { title: '配置', link: '/guide/config' },
      { title: 'CLI', link: '/guide/cli' },
      { title: '打包器', link: '/guide/bundlers' },
      { title: '插件', link: '/guide/plugins' },
      { title: '架构设计', link: '/guide/architecture' },
    ],
    footer: 'Open-source MIT Licensed | Copyright © Harhao ',
    socialLinks: {
      github: 'https://github.com/Harhao',
    },
  },
});
