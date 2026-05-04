import type { APIRoute } from 'astro';
import { getPublishedPosts, type BlogEntry } from '../lib/blog';
import { withBase } from '../lib/site';

function createExcerpt(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();
  const items = posts.map((post: BlogEntry) => ({
    title: post.data.title,
    description: post.data.description,
    slug: post.slug,
    url: withBase(`/posts/${post.slug}/`),
    tags: post.data.tags,
    pubDate: post.data.pubDate.toISOString(),
    excerpt: createExcerpt(post.body)
  }));

  return new Response(JSON.stringify({ ok: true, items }), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300'
    }
  });
};
