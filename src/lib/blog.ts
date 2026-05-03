import { getCollection, type CollectionEntry } from 'astro:content';

export type BlogEntry = CollectionEntry<'blog'>;

export async function getPublishedPosts() {
  const posts = await getCollection('blog', ({ data }: BlogEntry) => !data.draft);
  return posts.sort((a: BlogEntry, b: BlogEntry) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getFeaturedPosts() {
  const posts = await getPublishedPosts();
  return posts.filter((post: BlogEntry) => post.data.featured).slice(0, 3);
}

export async function getRecentPosts(limit = 6) {
  const posts = await getPublishedPosts();
  return posts.slice(0, limit);
}

export async function getTagsWithCounts() {
  const posts = await getPublishedPosts();
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'zh-CN'));
}

export async function getPostsByTag(tag: string) {
  const posts = await getPublishedPosts();
  return posts.filter((post: BlogEntry) => post.data.tags.includes(tag));
}

export async function getArchiveGroups() {
  const posts = await getPublishedPosts();
  const groups = new Map<string, BlogEntry[]>();

  for (const post of posts) {
    const year = String(post.data.pubDate.getFullYear());
    const group = groups.get(year) ?? [];
    group.push(post);
    groups.set(year, group);
  }

  return [...groups.entries()].map(([year, items]) => ({ year, items }));
}

export async function getAdjacentPosts(slug: string) {
  const posts = await getPublishedPosts();
  const index = posts.findIndex((post: BlogEntry) => post.slug === slug);

  return {
    previous: index < posts.length - 1 ? posts[index + 1] : undefined,
    next: index > 0 ? posts[index - 1] : undefined
  };
}
