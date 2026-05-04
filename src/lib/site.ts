export const siteConfig = {
  title: 'Lin Notes',
  description: '一个偏工程与工具的个人技术博客，把问题定位、工具链细节和长期有效的方法论整理成持续输出。',
  author: 'LENOVO',
  siteUrl: 'https://ximo.qzz.io/',
  defaultSocialImage: '/images/uploads/default-social-card.svg',
  twitterSite: '',
  locale: 'zh-CN',
  brand: {
    label: 'Engineering Field Journal',
    heroTitle: '把工程现场写成长期可复用的笔记。',
    heroSubtitle: '这里记录嵌入式、工具链、自动化与内容系统实践，也记录每一次判断背后的取舍与方法。',
    authorRole: '工程实践者 / 工具链整理者 / 长期写作者',
    status: '持续更新',
    headerBlurb: '冷静、克制，但保留足够的细节密度。',
    footerBlurb: '不是展示式主页，而是一份持续积累的工程写作样本。',
    closingNote: '如果一篇文章能让后来的自己少走一次弯路，它就值得被写下来。',
    focusAreas: [
      {
        title: '嵌入式与底层工具链',
        description: '记录环境、编译链路与硬件相关问题的拆解过程。'
      },
      {
        title: '工程效率与自动化',
        description: '把重复工作压缩成稳定流程，让产出速度更可持续。'
      },
      {
        title: '前端与内容系统实践',
        description: '关注内容结构、发布链路与交互体验如何协同工作。'
      }
    ],
    principles: [
      '写结论，也写路径',
      '关注可复用的方法，不只是一时方案',
      '让站点像长期作品，而不是一次性模板'
    ]
  },
  nav: [
    { href: '/', label: '首页' },
    { href: '/posts', label: '文章' },
    { href: '/topics', label: '专题' },
    { href: '/search', label: '搜索' },
    { href: '/tags', label: '标签' },
    { href: '/archive', label: '归档' },
    { href: '/about', label: '关于' }
  ],
  admin: {
    enabled: true,
    path: '/admin/',
    label: '发布文章'
  },
  comments: {
    enabled: true,
    apiBaseUrl: 'https://comments-api-worker.251873620.workers.dev',
    turnstileSiteKey: '0x4AAAAAADIbvinBtVXm-wlC',
    maxDepth: 2,
    adminPath: '/admin/comments/',
    adminLabel: '评论管理'
  },
  socialLinks: [
    { href: 'https://github.com/PWMPro-a/my-blog', label: 'GitHub' }
  ]
} as const;

const basePath = import.meta.env.BASE_URL === '/' ? '' : import.meta.env.BASE_URL.replace(/\/$/, '');
const absoluteUrlPattern = /^https?:\/\//i;
const placeholderPattern = /<your-/i;

function isConfiguredValue(value: string) {
  return Boolean(value) && !placeholderPattern.test(value);
}

export function withBase(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${basePath}${normalizedPath}` || '/';
}

export function withAsset(path: string) {
  return absoluteUrlPattern.test(path) ? path : withBase(path);
}

export function withSiteUrl(path: string) {
  return new URL(withBase(path), siteConfig.siteUrl).toString();
}

export function withSiteAssetUrl(path: string) {
  return absoluteUrlPattern.test(path) ? path : new URL(withBase(path), siteConfig.siteUrl).toString();
}

export const isCommentsConfigured = siteConfig.comments.enabled && isConfiguredValue(siteConfig.comments.apiBaseUrl);
export const isTurnstileConfigured = isConfiguredValue(siteConfig.comments.turnstileSiteKey);
