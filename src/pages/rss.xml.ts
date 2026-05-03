import { getCollection, type CollectionEntry } from 'astro:content';
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { siteConfig, withBase } from '../lib/site';

type BlogEntry = CollectionEntry<'blog'>;

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }: BlogEntry) => !data.draft);

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: context.site ?? siteConfig.siteUrl,
    items: posts
      .sort((a: BlogEntry, b: BlogEntry) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
      .map((post: BlogEntry) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: withBase(`/posts/${post.slug}/`)
      }))
  });
}
