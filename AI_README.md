# AI README for Lin Notes

This file is for future AI agents maintaining this repository. It summarizes how the project is structured, how it is deployed, and what must be checked before changes are pushed.

## Project overview

Lin Notes is a personal technical blog built as a static Astro site with a Decap CMS writing backend, editable topics, search, SEO helpers, safe media rules, and a self-hosted comments system.

Production site:

- Main site: `https://ximo.qzz.io`
- Writing backend: `/admin/`
- Comment moderation backend: `/admin/comments/`

Repository:

- GitHub repo: `PWMPro-a/my-blog`
- Main branch: `main`
- Local working path used during the original build: `C:/Users/LENOVO/Desktop/my-blog-repo`

## Tech stack

Main site:

- Astro 5
- TypeScript
- Tailwind CSS
- Astro content collections
- Decap CMS
- GitHub Pages

Comments and auth:

- Cloudflare Worker for comments API
- Cloudflare D1 for comment storage
- Cloudflare Turnstile for visitor anti-spam
- GitHub OAuth for comment moderation admin
- Separate Cloudflare Worker for Decap GitHub OAuth login

Content and media:

- Blog posts: `src/content/blog/*.md`
- Topics: `src/content/topics/*.md`
- Images: `public/images/uploads`
- Attachments: `public/attachments/uploads`
- Decap config: `public/admin/config.yml`

## Important files and directories

Site config and layout:

- `src/lib/site.ts` — site metadata, nav, admin/comment config, URL helpers.
- `src/content/config.ts` — Astro content collection schemas.
- `src/layouts/BaseLayout.astro` — main page shell and SEO wiring.
- `src/layouts/BlogPostLayout.astro` — article layout, table of contents, attachments, comments.
- `src/components/SEO.astro` — SEO and social sharing tags.
- `src/styles/global.css` — global prose, image, video, and attachment styles.

Content features:

- `src/lib/blog.ts` — blog collection helpers.
- `src/lib/topics.ts` — topic collection helpers.
- `src/pages/topics/index.astro` — topic list page.
- `src/pages/topics/[topic].astro` — topic detail pages.
- `src/pages/search.astro` — search UI.
- `src/pages/search.json.ts` — generated search index.

Decap CMS:

- `public/admin/index.html` — custom admin landing shell and Decap initialization.
- `public/admin/config.yml` — Decap backend, collections, fields, filters, hints.
- `public/admin/cms-extensions.js` — Decap editor components and preview template.
- `public/admin/decap-cms.js` — bundled vendor file; do not edit unless intentionally updating Decap.

Validation and tooling:

- `scripts/check-media-uploads.mjs` — enforces upload directory file types.
- `scripts/validate-content.mjs` — validates frontmatter, media references, attachments, and content warnings.
- `scripts/docx-to-markdown.mjs` — local helper to convert DOCX to Markdown-like text.
- `package.json` — scripts and dependencies.
- `.github/workflows/deploy.yml` — GitHub Pages CI deploy workflow.

Workers:

- `worker/comments-api/` — comments API Worker.
- `worker/comments-api/src/index.ts` — public comments, likes, admin moderation, health/stats endpoints.
- `worker/comments-api/migrations/` — D1 schema migrations.
- `worker/comments-api/wrangler.toml` — comments Worker config.
- `worker/decap-oauth/` — Decap GitHub OAuth Worker.

Project skill:

- `.claude/skills/lin-notes-site-builder/SKILL.md` — reusable skill distilled from the original build process.

## Current content model

Blog posts use Astro content schema with these fields:

- `title: string`
- `description: string`
- `pubDate: date`
- `updatedDate?: date`
- `tags: string[]`
- `draft: boolean`
- `featured: boolean`
- `heroImage?: string`
- `attachments: Attachment[]`

Attachment fields:

- `title: string`
- `file: string`
- `type: 'pdf' | 'docx' | 'doc' | 'other'`
- `description?: string`

Topics use:

- `title`
- `description`
- `coverImage?`
- `order`
- `draft`
- `posts: string[]`

## Publishing backend behavior

Decap CMS is configured in `public/admin/config.yml`.

Important conventions:

- Blog post drafts default to `true` in the CMS.
- `publish_mode: editorial_workflow` is enabled.
- Blog entries support filters for drafts, published posts, and featured posts.
- Topic entries support filters for draft and published topics.
- Image uploads go to `public/images/uploads` and are served from `/images/uploads`.
- Attachment uploads go to `public/attachments/uploads` and are served from `/attachments/uploads`.
- PDF, DOC, and DOCX should be uploaded as attachments.
- DOCX can be converted locally with `npm run docx:markdown -- <file.docx>` and copied into the body.
- PDF is intentionally not parsed automatically because extraction quality is unreliable.

CMS extensions:

- Prompt/tip block insert helper.
- Code block insert helper.
- Video link helper.
- Attachment link helper.
- Blog preview template with SEO hints and attachment preview.

Do not edit `public/admin/decap-cms.js` for custom behavior. Put project customizations in `public/admin/cms-extensions.js`.

## Public config vs Worker secrets

Some configuration is intentionally public because it is shipped to the browser or visible in Decap config:

- Production site URL: `https://ximo.qzz.io`
- Public comments API base URL in `src/lib/site.ts`
- Turnstile site key in frontend config
- Admin paths such as `/admin/` and `/admin/comments/`
- Decap OAuth public endpoint/base URL in `public/admin/config.yml`

These must stay only in Cloudflare Worker secrets, bindings, or protected environment config:

- GitHub OAuth client secret
- Turnstile secret key
- Admin session or signing secrets
- D1 database binding/config that should not be exposed beyond Worker config
- Any Wrangler secret output or local `.env` values

Never paste secrets into frontend files, Markdown content, Decap config, commit messages, screenshots, or generated docs. Public IDs and site keys are not enough to impersonate the service; private secrets are.

## Media policy

Allowed:

- Images in `public/images/uploads`: AVIF, GIF, JPEG, JPG, PNG, SVG, WEBP.
- Attachments in `public/attachments/uploads`: PDF, DOC, DOCX.
- Videos as external HTTPS links in Markdown.

Not allowed:

- Local video uploads into the repo.
- Executable files.
- Archives such as ZIP, RAR, or 7Z.
- Attachments in the image upload directory.
- Arbitrary HTML embeds in Markdown.

Video links should be standalone HTTPS lines when possible. Existing video embed logic is designed around safe external URLs.

## Comments system

The public article page renders comments through `src/components/CommentsSection.astro`.

Key behavior:

- Visitor submits comment through the comments Worker API.
- Turnstile token must be captured before the form re-renders into a submitting state.
- Comments can be liked lightly.
- Some comments can be marked as liked by the blog owner.
- Admin moderation is at `/admin/comments/`.
- Admin auth uses GitHub OAuth through the comments Worker.
- Admin UI includes filtering, stats, health check, moderation actions, replies, likes, and owner-like state.

When debugging comments, check:

1. `src/lib/site.ts` comments config.
2. Worker environment variables and secrets.
3. D1 migrations.
4. Turnstile site key and secret key.
5. CORS origin handling in the Worker.
6. GitHub OAuth callback URL and secrets.

Do not commit secrets.

## Deployment

Main site deployment:

- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` or manual workflow dispatch.
- Build command in CI: `npm run deploy:check`
- Output directory: `dist`
- Host: GitHub Pages

Comments Worker deployment:

- Worker directory: `worker/comments-api`
- Use Wrangler with explicit config path on Windows if needed.
- Deploy only when the user asks.

Decap OAuth Worker:

- Worker directory: `worker/decap-oauth`
- Used for Decap CMS GitHub login.

## Required checks before push

Run from the repo root:

```bash
npm run check:media
npm run check:content
npm run check
npm run check:workers
npm run build
npm run deploy:check
```

`npm run deploy:check` includes media/content validation, Astro type checking, Worker dry-run checks, and the production build.

`npm run check:content` may print SEO/content warnings for existing posts. Warnings do not block the build; errors do.

Common current warnings may include:

- Existing article titles/descriptions shorter than the recommended SEO range.
- Existing published articles without a hero image, which will use the default social card.

## Local development

Start the site locally:

```bash
npm run dev -- --host 127.0.0.1 --port 4333
```

Useful smoke-test paths:

- `/`
- `/posts/`
- `/posts/welcome/`
- `/topics/`
- `/search/`
- `/search.json`
- `/admin/index.html`
- `/admin/comments/`

In Astro dev server, `/admin/` may not resolve the same way as static hosting; use `/admin/index.html` for local static checks if needed.

## Git workflow

Only commit or push when the user explicitly asks.

Before committing:

```bash
git status --short
git diff
git log -5 --oneline
```

Stage specific files. Do not use broad `git add -A` unless the user clearly intends all changes to be committed and the status has been inspected.

Commit messages in this repo are concise sentence-style messages, for example:

- `Improve publishing workflow safeguards.`
- `Improve blog discovery and comment admin tools.`
- `Fix comment Turnstile submission flow.`

Include co-author footer when committing as Claude:

```text
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

When normal GitHub push fails on this machine, use the local proxy:

```bash
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push
```

## DNS and domain notes

The production custom domain is `ximo.qzz.io`.

Lessons from setup:

- DNS should be managed where the active nameservers point.
- If using Cloudflare nameservers at the registrar, create records in Cloudflare, not only at the registrar.
- Apex/root domain CNAME behavior depends on flattening support.
- GitHub Pages DNS checks can lag after DNS changes.
- Use `nslookup ximo.qzz.io 1.1.1.1` and `nslookup www.ximo.qzz.io 1.1.1.1` to inspect public DNS.

## Security and maintenance cautions

- Never commit `.env`, secrets, OAuth client secrets, Turnstile secrets, or Worker secrets.
- Do not weaken Turnstile or OAuth checks just to make local testing easier.
- Do not bypass validation scripts in CI.
- Avoid arbitrary HTML in posts and CMS components.
- Escape any CMS preview HTML generated from user-entered fields.
- Prefer safe external video embeds over raw iframe HTML.
- Be careful with Worker deployments because they affect production behavior immediately.

## Practical extension strategy

When adding new features:

1. Reuse existing Astro content collections and Decap config first.
2. Add schema validation in `src/content/config.ts`.
3. Add publish-time validation in `scripts/validate-content.mjs` if the feature introduces new content paths or file types.
4. Add UI rendering in the appropriate layout/component.
5. Add minimal CSS in `src/styles/global.css` or the relevant component.
6. Run `npm run deploy:check`.
7. For UI features, start the dev server and check the affected page.
8. Commit and push only after user approval.

Keep changes small and direct. This project values long-term maintainability and clear writing workflows more than clever abstractions.
