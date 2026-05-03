export const siteConfig = {
  title: 'Lin Notes',
  description: '一个偏工程与工具的个人技术博客，记录我写代码、做项目和整理思路的过程。',
  author: 'LENOVO',
  siteUrl: 'https://pwmpro-a.github.io/my-blog/',
  locale: 'zh-CN',
  nav: [
    { href: '/', label: '首页' },
    { href: '/posts', label: '文章' },
    { href: '/tags', label: '标签' },
    { href: '/archive', label: '归档' },
    { href: '/about', label: '关于' }
  ],
  admin: {
    enabled: true,
    path: '/admin/',
    label: '发布文章'
  },
  socialLinks: [
    { href: 'https://github.com/PWMPro-a/my-blog', label: 'GitHub' }
  ],
  giscus: {
    repo: 'PWMPro-a/my-blog',
    repoId: 'R_kgDOSSxbHg',
    category: 'Announcements',
    categoryId: 'DIC_kwDOSSxbHs4C8NvZ',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    inputPosition: 'top',
    lang: 'zh-CN'
  }
} as const;

const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');

export function withBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}` || '/';
}

export function withSiteUrl(path: string) {
  return new URL(withBase(path), siteConfig.siteUrl).toString();
}

export const isGiscusConfigured = Object.values(siteConfig.giscus).slice(0, 4).every(Boolean);
