---
title: 做一个内容站点时，我最看重哪些基础能力
description: 内容系统不只是能发文章，更重要的是结构清晰、维护简单、长期稳定。
pubDate: 2026-04-20
tags:
  - astro
  - frontend
  - architecture
featured: true
draft: false
---

一个内容站点如果只是“能渲染页面”，其实远远不够。真正决定后续维护成本的，是那些一开始很容易被忽略的基础能力。

## 内容模型要明确

至少需要回答这些问题：

- 文章有哪些必填字段
- 草稿怎么区分
- 标签和归档怎么生成
- 页面元信息从哪里统一管理

## 样式系统要克制

视觉好看很重要，但结构稳定更重要。对于技术博客来说，可读性、层级和代码块体验通常比花哨动画更值得优先投入。

## 评论系统要低耦合

如果评论只是一个附加能力，就不应该让它污染页面主体结构。把第三方评论封装成独立组件，是一种更耐维护的做法。

### 一个简单的代码示例

```ts
export function sortByDate<T extends { pubDate: Date }>(items: T[]) {
  return [...items].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());
}
```

这类基础函数不一定复杂，但最好只写一次，并在全站复用。
