---
name: my-web-skills
description: Build and maintain the user's websites using a practical, static-first, maintainable workflow distilled from the Lin Notes project; applies to blogs, portfolio sites, documentation sites, landing pages, small business sites, and lightweight web apps.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(git *), Bash(npm *), Bash(node *), Bash(python *), Bash(curl *), Bash(nslookup *)
---

# My web-building workflow

Use this skill when the user wants to create, extend, debug, deploy, or document a website. It is intentionally broader than the Lin Notes blog skill and should apply to many website types, while preserving the user's preferred way of working.

## Working style for this user

- Prefer practical staged delivery over a large rewrite.
- Start with a simple, reliable architecture, then add polish and automation after the core site works.
- Keep content easy to edit by the site owner rather than requiring code changes for every update.
- Preserve clear maintenance notes so future AI agents can continue work smoothly.
- Use visible admin or management entrances for important workflows when a backend exists.
- Run local checks before saying work is complete.
- Commit and push only when the user explicitly asks.
- If GitHub push fails on this machine, retry with the local proxy:
  `git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push`

## Recommended default architecture

For most personal, content, marketing, portfolio, and documentation websites, prefer:

- Static-first site generation when possible.
- Astro or a similarly lightweight framework for content-heavy sites.
- TypeScript for safer maintenance.
- Markdown or structured content collections for pages that change over time.
- A simple CMS or editable content layer if the user needs browser-based editing.
- GitHub Pages, Cloudflare Pages, Netlify, or Vercel for static hosting.
- Cloudflare Workers or small serverless functions only for dynamic features that truly need backend logic.
- Validation scripts that catch broken content, links, media paths, and deployment mistakes before publishing.

Avoid by default:

- Building a full custom backend when static pages plus a CMS are enough.
- Adding a database before a feature genuinely needs shared dynamic state.
- Letting authors paste arbitrary HTML into content.
- Uploading large videos or unsafe binary files into the repository.
- Bypassing validation or deployment checks just to make a push pass.

## Website-type patterns

### Personal blog or knowledge site

Use:

- Content collections for posts, topics, tags, and optional attachments.
- Search index generated at build time.
- SEO and social sharing metadata.
- Optional comments through a lightweight external or serverless system.
- Safe media policy: images in repo, videos as external HTTPS links, documents as attachments.

### Portfolio or resume site

Use:

- Structured collections for projects, experience, skills, and case studies.
- Strong homepage sections: intro, selected work, skills, contact, links.
- Case-study pages with problem, role, process, result, and screenshots.
- Downloadable resume as a static attachment if needed.
- Simple contact links first; add a form only if the user needs it.

### Documentation or product knowledge base

Use:

- Markdown-first docs with sidebar navigation and table of contents.
- Version, status, or last-updated metadata when useful.
- Search and clear category pages.
- Strict link and image validation.
- Practical maintenance docs for contributors and future AI agents.

### Small business or landing page

Use:

- Fast static pages with clear conversion actions.
- Editable sections for services, pricing, FAQ, testimonials, and contact info.
- Minimal analytics and forms only when needed.
- Strong SEO basics: title, description, canonical URL, Open Graph image, structured headings.
- Deployment that non-technical owners can trust and repeat.

### Lightweight tool or interactive site

Use:

- Client-side interactivity for calculators, generators, demos, and local-only tools.
- Serverless endpoints only for persistence, authentication, payments, emails, or shared data.
- Clear input validation at user and API boundaries.
- Keep UI state simple before introducing a global state library.

## Content and CMS conventions

When the user needs browser-based editing:

1. Prefer an existing CMS or content workflow before creating a custom admin.
2. Store content in structured fields, not scattered ad-hoc Markdown conventions.
3. Add helpful field hints in the user's preferred language.
4. Keep drafts or review workflows enabled when accidental publishing is likely.
5. Provide preview templates that show the actual content, SEO warnings, media, and publish state.
6. Keep CMS customizations in project-owned extension files, not vendor bundles.
7. Validate content in scripts so mistakes are caught locally and in CI.

Good reusable fields:

- `title`
- `description`
- `slug` when manual URL control matters
- `draft` or `published`
- `pubDate` / `updatedDate` for articles or docs
- `heroImage` / `coverImage` for shareable pages
- `tags` / `categories` / `topics`
- `order` for manually sorted navigation
- `attachments` for downloadable files

## Media rules

Use this default split unless the project has a better reason:

- Images: repository or CMS upload folder, with common image extensions only.
- Documents: a separate attachments folder, usually PDF/DOC/DOCX only.
- Videos: external hosting links, embedded safely from HTTPS URLs.
- Downloads: explicit attachment cards or links, never hidden executable uploads.

Block or avoid:

- Executables such as `.exe`, `.bat`, `.cmd`, `.msi`.
- Archives such as `.zip`, `.rar`, `.7z` unless the user explicitly needs downloadable packages.
- Local video files in the repository.
- Arbitrary iframe or script embeds from user-entered content.

## Dynamic feature pattern

Add backend pieces only for features that need them:

- Comments: Worker/serverless API plus database or managed comment service.
- Contact form: serverless function plus spam protection.
- Authentication: established OAuth/provider flow, not custom password storage unless necessary.
- Moderation/admin tools: visible admin entrance, clear auth, audit-friendly actions.
- Likes/reactions: lightweight counters with basic abuse limits.
- Search: static JSON index first; external search service only if content volume requires it.

For any dynamic feature:

1. Identify data owner and storage location.
2. Define public API routes and admin-only routes separately.
3. Validate all external input at the boundary.
4. Configure CORS intentionally.
5. Keep secrets out of the repository.
6. Document deployment and rollback steps.

## Design and UI guidance

Default visual direction for this user:

- Calm, restrained, engineering-focused style.
- Clear typography and spacing over flashy effects.
- Responsive layouts that work well on mobile first.
- Persistent navigation for important destinations.
- Chinese UI copy when the user-facing site is primarily Chinese.
- Avoid adding large UI frameworks unless they solve a real problem.

For each new page or feature:

- Make the main action obvious.
- Keep empty states and error states understandable.
- Prefer accessible semantic HTML.
- Use images with meaningful alt text when possible.
- Verify dark mode if the site supports it.

## SEO and sharing checklist

For public pages, include or verify:

- Unique title and description.
- Canonical URL.
- Open Graph and Twitter card tags.
- Share image or safe default social card.
- Structured heading order.
- Sitemap and robots behavior if the site needs indexing.
- Descriptive internal links.
- No accidental indexing of admin or private pages.

Content warnings should be warnings, not blockers, when they are subjective. Broken references and invalid required metadata should fail checks.

## Validation workflow

Before publishing or claiming a website change is complete, run the relevant local checks:

```bash
npm run check
npm run build
```

If the project has custom validation scripts, run those too, for example:

```bash
npm run check:media
npm run check:content
npm run deploy:check
```

For UI changes:

1. Start the local dev server on a fixed port when possible.
2. Visit the affected page and at least one neighboring route.
3. Check the golden path and one likely edge case.
4. If login or third-party services cannot be fully tested locally, state exactly what was and was not verified.

## Deployment workflow

Before deploying:

1. Confirm the target host and production URL.
2. Confirm whether deployment happens through GitHub Actions, Pages, Workers, or another platform.
3. Run the same checks CI will run.
4. Do not deploy Workers, serverless functions, or production infrastructure unless the user asks.
5. Do not push code unless the user asks.

For custom domains:

- Configure DNS where active nameservers point.
- Use provider-supported CNAME flattening for apex/root domains when needed.
- Use `www` CNAMEs when appropriate.
- Expect DNS and certificate checks to lag after changes.
- Use `nslookup <domain> 1.1.1.1` to inspect public DNS.

## Security and maintenance cautions

Always protect:

- `.env` files.
- OAuth client secrets.
- API tokens.
- Turnstile or CAPTCHA secrets.
- Worker/serverless secrets.
- Private database credentials.

Do not:

- Commit secrets.
- Weaken auth, spam protection, or validation to simplify local testing.
- Add arbitrary HTML/script execution paths for content authors.
- Trust form input or external API input without validation.
- Force-push, reset, or delete user work without explicit authorization.

## Documentation to leave behind

For substantial projects, create or update AI-facing maintenance notes when the user asks. A useful AI README should include:

- Project overview and production URLs.
- Tech stack.
- Important files and directories.
- Content model or data model.
- Local development commands.
- Validation and deployment commands.
- Security cautions.
- Known deployment or DNS lessons.
- Git workflow and push proxy notes if relevant.

Keep the docs practical. Future maintainers should know where to look, what not to touch, and what checks to run.