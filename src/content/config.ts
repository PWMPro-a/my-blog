import { defineCollection, z } from 'astro:content';

const attachmentSchema = z.object({
  title: z.string(),
  file: z.string(),
  type: z.enum(['pdf', 'docx', 'doc', 'other']).default('other'),
  description: z.string().optional()
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    heroImage: z.string().optional(),
    attachments: z.array(attachmentSchema).default([])
  })
});

const topics = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    coverImage: z.string().optional(),
    order: z.number().default(999),
    draft: z.boolean().default(false),
    posts: z.array(z.string()).default([])
  })
});

export const collections = { blog, topics };
