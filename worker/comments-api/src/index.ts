interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  ALLOWED_ADMIN_URL: string;
  PUBLIC_SITE_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_OAUTH_REDIRECT_URI: string;
  ADMIN_GITHUB_USERS: string;
  TURNSTILE_SECRET_KEY: string;
}

type CommentStatus = 'pending' | 'approved' | 'rejected' | 'spam' | 'hidden';

type CommentRow = {
  id: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  authorName: string;
  authorWebsite: string | null;
  body: string;
  bodyHtml: string;
  status: CommentStatus;
  likeCount: number;
  likedByViewer?: number | boolean | null;
  bloggerLiked: number | boolean;
  createdAt: string;
  postSlug?: string;
  postTitle?: string | null;
  parentAuthorName?: string | null;
  parentBodyExcerpt?: string | null;
};

type CommentNode = {
  id: string;
  parentId: string | null;
  rootId: string | null;
  depth: number;
  authorName: string;
  authorWebsite: string | null;
  bodyHtml: string;
  likeCount: number;
  likedByViewer: boolean;
  bloggerLiked: boolean;
  createdAt: string;
  replies: CommentNode[];
};

type AdminSession = {
  githubUserId: number;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string | null;
  expiresAt: string;
};

const STATE_COOKIE = 'comments-admin-state';
const SESSION_COOKIE = 'comments-admin-session';
const MAX_DEPTH = 2;
const MAX_BODY_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_SUBMISSIONS = 6;

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers
    }
  });
}

function redirect(location: string, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('location', location);
  headers.set('cache-control', 'no-store');

  return new Response(null, {
    ...init,
    status: init.status ?? 302,
    headers
  });
}

function createToken(byteLength = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${key}=`));
  return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

function isPlaceholder(value: string | undefined) {
  return !value || value.includes('<your-');
}

function validateEnv(env: Env) {
  const missing = [
    ['ALLOWED_ORIGIN', env.ALLOWED_ORIGIN],
    ['ALLOWED_ADMIN_URL', env.ALLOWED_ADMIN_URL],
    ['PUBLIC_SITE_URL', env.PUBLIC_SITE_URL],
    ['GITHUB_CLIENT_ID', env.GITHUB_CLIENT_ID],
    ['GITHUB_CLIENT_SECRET', env.GITHUB_CLIENT_SECRET],
    ['GITHUB_OAUTH_REDIRECT_URI', env.GITHUB_OAUTH_REDIRECT_URI],
    ['ADMIN_GITHUB_USERS', env.ADMIN_GITHUB_USERS],
    ['TURNSTILE_SECRET_KEY', env.TURNSTILE_SECRET_KEY]
  ].filter(([, value]) => isPlaceholder(value));

  return missing.map(([key]) => key);
}

function getRequestOrigin(request: Request) {
  return request.headers.get('origin');
}

function isAllowedOrigin(origin: string | null, env: Env) {
  if (!origin) return false;
  if (origin === env.ALLOWED_ORIGIN) return true;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function withCors(request: Request, env: Env, response: Response) {
  const origin = getRequestOrigin(request);
  if (!isAllowedOrigin(origin, env)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin!);
  headers.set('access-control-allow-credentials', 'true');
  headers.set('access-control-allow-headers', 'content-type,x-comment-visitor');
  headers.set('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  headers.set('vary', 'Origin');
  return new Response(response.body, { ...response, headers });
}

function handleOptions(request: Request, env: Env) {
  const origin = getRequestOrigin(request);
  if (!isAllowedOrigin(origin, env)) {
    return new Response(null, { status: 403 });
  }
  return withCors(
    request,
    env,
    new Response(null, {
      status: 204,
      headers: {
        'access-control-max-age': '86400'
      }
    })
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderBodyHtml(body: string) {
  return escapeHtml(body).replace(/\n/g, '<br />');
}

function normalizeBody(body: unknown) {
  if (typeof body !== 'string') return '';
  return body.replace(/\r\n/g, '\n').trim();
}

function normalizeAuthorName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 60);
}

function normalizeWebsite(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeStatus(value: string | null): CommentStatus | '' {
  if (!value) return '';
  return ['pending', 'approved', 'rejected', 'spam', 'hidden'].includes(value) ? (value as CommentStatus) : '';
}

function buildPublicSiteUrl(env: Env, slug: string) {
  return `${env.PUBLIC_SITE_URL.replace(/\/$/, '')}/posts/${slug.replace(/^\//, '')}/`;
}

async function sha256(value: string) {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function parseJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown';
}

function getVisitorToken(request: Request) {
  const token = request.headers.get('x-comment-visitor')?.trim() ?? '';
  return /^[a-zA-Z0-9_-]{16,128}$/.test(token) ? token : '';
}

async function getVisitorHash(request: Request) {
  const token = getVisitorToken(request);
  return token ? sha256(token) : '';
}

async function verifyTurnstile(token: string | undefined, request: Request, env: Env) {
  const workerUrl = new URL(request.url);
  const isLocalDev = ['localhost', '127.0.0.1'].includes(workerUrl.hostname);

  if (isPlaceholder(env.TURNSTILE_SECRET_KEY)) {
    return isLocalDev;
  }

  if (!token) {
    return false;
  }

  const formData = new FormData();
  formData.set('secret', env.TURNSTILE_SECRET_KEY);
  formData.set('response', token);
  formData.set('remoteip', getClientIp(request));

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { success?: boolean };
  return Boolean(data.success);
}

async function ensureRateLimit(env: Env, ipHash: string) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM comments
     WHERE ip_hash = ?1 AND created_at >= ?2`
  )
    .bind(ipHash, windowStart)
    .first<{ count: number }>();

  return Number(result?.count ?? 0) < RATE_LIMIT_MAX_SUBMISSIONS;
}

async function getOrCreatePost(env: Env, slug: string, titleSnapshot?: string, urlSnapshot?: string) {
  const existing = await env.DB.prepare('SELECT id FROM posts WHERE slug = ?1').bind(slug).first<{ id: string }>();
  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE posts
       SET title_snapshot = COALESCE(?2, title_snapshot),
           url_snapshot = COALESCE(?3, url_snapshot),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1`
    )
      .bind(existing.id, titleSnapshot ?? null, urlSnapshot ?? null)
      .run();
    return existing.id;
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO posts (id, slug, title_snapshot, url_snapshot)
     VALUES (?1, ?2, ?3, ?4)`
  )
    .bind(id, slug, titleSnapshot ?? null, urlSnapshot ?? null)
    .run();
  return id;
}

async function getCommentById(env: Env, commentId: string) {
  return env.DB.prepare(
    `SELECT id,
            post_id as postId,
            parent_id as parentId,
            root_id as rootId,
            depth,
            status,
            author_name as authorName,
            body,
            body_html as bodyHtml
     FROM comments
     WHERE id = ?1`
  )
    .bind(commentId)
    .first<{
      id: string;
      postId: string;
      parentId: string | null;
      rootId: string | null;
      depth: number;
      status: CommentStatus;
      authorName: string;
      body: string;
      bodyHtml: string;
    }>();
}

function buildCommentTree(rows: CommentRow[]) {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      rootId: row.rootId,
      depth: row.depth,
      authorName: row.authorName,
      authorWebsite: row.authorWebsite,
      bodyHtml: row.bodyHtml,
      likeCount: Number(row.likeCount ?? 0),
      likedByViewer: Boolean(row.likedByViewer),
      bloggerLiked: Boolean(row.bloggerLiked),
      createdAt: row.createdAt,
      replies: []
    });
  }

  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parentId) {
      const parent = byId.get(row.parentId);
      if (parent) {
        parent.replies.push(node);
        continue;
      }
    }
    roots.push(node);
  }

  return roots;
}

async function listApprovedComments(env: Env, slug: string, visitorHash: string) {
  const result = await env.DB.prepare(
    `SELECT comments.id,
            comments.parent_id as parentId,
            comments.root_id as rootId,
            comments.depth,
            comments.author_name as authorName,
            comments.author_website as authorWebsite,
            comments.body,
            comments.body_html as bodyHtml,
            comments.status,
            comments.like_count as likeCount,
            CASE WHEN comment_likes.id IS NULL THEN 0 ELSE 1 END as likedByViewer,
            comments.blogger_liked as bloggerLiked,
            comments.created_at as createdAt
     FROM comments
     INNER JOIN posts ON posts.id = comments.post_id
     LEFT JOIN comment_likes ON comment_likes.comment_id = comments.id AND comment_likes.visitor_hash = ?2
     WHERE posts.slug = ?1 AND comments.status = 'approved'
     ORDER BY comments.created_at ASC`
  )
    .bind(slug, visitorHash)
    .all<CommentRow>();

  return buildCommentTree(result.results ?? []);
}

async function toggleCommentLike(env: Env, request: Request, commentId: string, payload: { liked?: unknown }) {
  const visitorHash = await getVisitorHash(request);
  if (!visitorHash) {
    return json({ ok: false, error: '点赞标识无效，请刷新后重试。' }, { status: 400 });
  }

  if (typeof payload.liked !== 'boolean') {
    return json({ ok: false, error: '点赞数据格式不正确。' }, { status: 400 });
  }

  const existing = await getCommentById(env, commentId);
  if (!existing || existing.status !== 'approved') {
    return json({ ok: false, error: '评论不存在，或当前不可点赞。' }, { status: 404 });
  }

  if (payload.liked) {
    const ipHash = await sha256(getClientIp(request));
    const userAgentHash = await sha256(request.headers.get('user-agent') ?? 'unknown');
    await env.DB.prepare(
      `INSERT OR IGNORE INTO comment_likes (id, comment_id, visitor_hash, ip_hash, user_agent_hash)
       VALUES (?1, ?2, ?3, ?4, ?5)`
    )
      .bind(crypto.randomUUID(), commentId, visitorHash, ipHash, userAgentHash)
      .run();
  } else {
    await env.DB.prepare('DELETE FROM comment_likes WHERE comment_id = ?1 AND visitor_hash = ?2').bind(commentId, visitorHash).run();
  }

  const countRow = await env.DB.prepare('SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?1')
    .bind(commentId)
    .first<{ count: number }>();
  const likeCount = Number(countRow?.count ?? 0);

  await env.DB.prepare(
    `UPDATE comments
     SET like_count = ?2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?1`
  )
    .bind(commentId, likeCount)
    .run();

  const likedRow = await env.DB.prepare('SELECT id FROM comment_likes WHERE comment_id = ?1 AND visitor_hash = ?2')
    .bind(commentId, visitorHash)
    .first<{ id: string }>();
  const comment = await env.DB.prepare('SELECT blogger_liked as bloggerLiked FROM comments WHERE id = ?1')
    .bind(commentId)
    .first<{ bloggerLiked: number | boolean }>();

  return json({
    ok: true,
    commentId,
    likeCount,
    likedByViewer: Boolean(likedRow),
    bloggerLiked: Boolean(comment?.bloggerLiked)
  });
}

async function createComment(
  env: Env,
  request: Request,
  slug: string,
  payload: {
    authorName?: unknown;
    authorWebsite?: unknown;
    body?: unknown;
    postTitle?: unknown;
    postUrl?: unknown;
    turnstileToken?: unknown;
    parentId?: unknown;
  }
) {
  const authorName = normalizeAuthorName(payload.authorName);
  const body = normalizeBody(payload.body);
  const authorWebsite = normalizeWebsite(payload.authorWebsite);
  const turnstileToken = typeof payload.turnstileToken === 'string' ? payload.turnstileToken : undefined;

  if (!authorName) {
    return json({ ok: false, error: '请输入昵称。' }, { status: 400 });
  }

  if (!body) {
    return json({ ok: false, error: '请输入评论内容。' }, { status: 400 });
  }

  if (body.length > MAX_BODY_LENGTH) {
    return json({ ok: false, error: `评论内容不能超过 ${MAX_BODY_LENGTH} 个字符。` }, { status: 400 });
  }

  const turnstilePassed = await verifyTurnstile(turnstileToken, request, env);
  if (!turnstilePassed) {
    return json({ ok: false, error: '评论验证未通过，请刷新后重试。' }, { status: 400 });
  }

  const ipHash = await sha256(getClientIp(request));
  const rateLimitAllowed = await ensureRateLimit(env, ipHash);
  if (!rateLimitAllowed) {
    return json({ ok: false, error: '提交过于频繁，请稍后再试。' }, { status: 429 });
  }

  const userAgentHash = await sha256(request.headers.get('user-agent') ?? 'unknown');
  const postId = await getOrCreatePost(
    env,
    slug,
    typeof payload.postTitle === 'string' ? payload.postTitle : undefined,
    typeof payload.postUrl === 'string' ? payload.postUrl : buildPublicSiteUrl(env, slug)
  );

  let parentId: string | null = null;
  let rootId: string | null = null;
  let depth = 0;

  if (typeof payload.parentId === 'string' && payload.parentId.trim()) {
    const parent = await getCommentById(env, payload.parentId);
    if (!parent || parent.status !== 'approved') {
      return json({ ok: false, error: '要回复的评论不存在，或当前不可回复。' }, { status: 404 });
    }

    if (parent.depth >= MAX_DEPTH) {
      return json({ ok: false, error: '这条评论已经达到最大回复层级。' }, { status: 400 });
    }

    parentId = parent.id;
    rootId = parent.rootId ?? parent.id;
    depth = parent.depth + 1;
  }

  const id = crypto.randomUUID();
  const bodyHtml = renderBodyHtml(body);
  await env.DB.prepare(
    `INSERT INTO comments (
      id, post_id, parent_id, root_id, depth, author_name, author_website,
      body, body_html, status, source, ip_hash, user_agent_hash
     )
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', 'public', ?10, ?11)`
  )
    .bind(id, postId, parentId, rootId, depth, authorName, authorWebsite, body, bodyHtml, ipHash, userAgentHash)
    .run();

  return json({
    ok: true,
    comment: {
      id,
      parentId,
      depth,
      authorName,
      authorWebsite,
      bodyHtml,
      createdAt: new Date().toISOString(),
      status: 'pending'
    }
  });
}

async function exchangeCodeForToken(code: string, env: Env) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_OAUTH_REDIRECT_URI
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Missing access token');
  }
  return data.access_token;
}

async function fetchGitHubUser(accessToken: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'lin-notes-comments-admin'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub user request failed with ${response.status}`);
  }

  return (await response.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };
}

function getAdminAllowlist(env: Env) {
  return env.ADMIN_GITHUB_USERS.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function sessionCookie(token: string, maxAgeSeconds: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`;
}

async function createAdminSession(env: Env, user: { id: number; login: string; name: string | null; avatar_url: string | null }) {
  const sessionToken = createToken(32);
  const sessionTokenHash = await sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO admin_sessions (session_token_hash, github_user_id, github_login, display_name, avatar_url, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
  )
    .bind(sessionTokenHash, user.id, user.login, user.name, user.avatar_url, expiresAt)
    .run();

  return { sessionToken, expiresAt };
}

async function getAdminSession(request: Request, env: Env) {
  const sessionToken = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  if (!sessionToken) return null;

  const sessionTokenHash = await sha256(sessionToken);
  const session = await env.DB.prepare(
    `SELECT github_user_id as githubUserId,
            github_login as githubLogin,
            display_name as displayName,
            avatar_url as avatarUrl,
            expires_at as expiresAt
     FROM admin_sessions
     WHERE session_token_hash = ?1`
  )
    .bind(sessionTokenHash)
    .first<AdminSession>();

  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE session_token_hash = ?1').bind(sessionTokenHash).run();
    return null;
  }

  return session;
}

async function destroyAdminSession(request: Request, env: Env) {
  const sessionToken = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE);
  if (!sessionToken) return;
  const sessionTokenHash = await sha256(sessionToken);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE session_token_hash = ?1').bind(sessionTokenHash).run();
}

async function listAdminComments(env: Env, status: CommentStatus | '', slug: string, page: number, pageSize: number) {
  const limit = Math.min(Math.max(pageSize, 1), 100);
  const offset = Math.max(page - 1, 0) * limit;

  const result = await env.DB.prepare(
    `SELECT comments.id,
            comments.parent_id as parentId,
            comments.root_id as rootId,
            comments.depth,
            comments.author_name as authorName,
            comments.author_website as authorWebsite,
            comments.body,
            comments.body_html as bodyHtml,
            comments.status,
            comments.like_count as likeCount,
            comments.blogger_liked as bloggerLiked,
            comments.created_at as createdAt,
            posts.slug as postSlug,
            posts.title_snapshot as postTitle,
            parent.author_name as parentAuthorName,
            substr(parent.body, 1, 120) as parentBodyExcerpt
     FROM comments
     INNER JOIN posts ON posts.id = comments.post_id
     LEFT JOIN comments AS parent ON parent.id = comments.parent_id
     WHERE (?1 = '' OR comments.status = ?1)
       AND (?2 = '' OR posts.slug = ?2)
     ORDER BY CASE comments.status WHEN 'pending' THEN 0 ELSE 1 END, comments.created_at DESC
     LIMIT ?3 OFFSET ?4`
  )
    .bind(status, slug, limit, offset)
    .all<CommentRow>();

  const countRow = await env.DB.prepare(
    `SELECT COUNT(*) as count
     FROM comments
     INNER JOIN posts ON posts.id = comments.post_id
     WHERE (?1 = '' OR comments.status = ?1)
       AND (?2 = '' OR posts.slug = ?2)`
  )
    .bind(status, slug)
    .first<{ count: number }>();

  return {
    items: result.results ?? [],
    total: Number(countRow?.count ?? 0),
    page,
    pageSize: limit
  };
}

async function getAdminStats(env: Env) {
  const result = await env.DB.prepare(
    `SELECT status, COUNT(*) as count
     FROM comments
     GROUP BY status`
  ).all<{ status: CommentStatus; count: number }>();

  const counts: Record<CommentStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    spam: 0,
    hidden: 0
  };

  for (const row of result.results ?? []) {
    counts[row.status] = Number(row.count ?? 0);
  }

  return counts;
}

async function moderateComment(env: Env, commentId: string, action: string, admin: AdminSession) {
  const existing = await getCommentById(env, commentId);
  if (!existing) {
    return json({ ok: false, error: '评论不存在。' }, { status: 404 });
  }

  if (action === 'toggle_blogger_like') {
    const result = await env.DB.prepare(
      `UPDATE comments
       SET blogger_liked = CASE WHEN blogger_liked = 1 THEN 0 ELSE 1 END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1
       RETURNING blogger_liked as bloggerLiked`
    )
      .bind(commentId)
      .first<{ bloggerLiked: number | boolean }>();

    await env.DB.prepare(
      `INSERT INTO comment_events (id, comment_id, admin_login, action)
       VALUES (?1, ?2, ?3, ?4)`
    )
      .bind(crypto.randomUUID(), commentId, admin.githubLogin, action)
      .run();

    return json({ ok: true, commentId, bloggerLiked: Boolean(result?.bloggerLiked) });
  }

  const nextStatus = ({
    approve: 'approved',
    reject: 'rejected',
    spam: 'spam',
    hide: 'hidden'
  } as const)[action as 'approve' | 'reject' | 'spam' | 'hide'];

  if (!nextStatus) {
    return json({ ok: false, error: '不支持的审核动作。' }, { status: 400 });
  }

  await env.DB.prepare(
    `UPDATE comments
     SET status = ?2,
         updated_at = CURRENT_TIMESTAMP,
         approved_at = CASE WHEN ?2 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
         approved_by = CASE WHEN ?2 = 'approved' THEN ?3 ELSE approved_by END
     WHERE id = ?1`
  )
    .bind(commentId, nextStatus, admin.githubLogin)
    .run();

  await env.DB.prepare(
    `INSERT INTO comment_events (id, comment_id, admin_login, action)
     VALUES (?1, ?2, ?3, ?4)`
  )
    .bind(crypto.randomUUID(), commentId, admin.githubLogin, action)
    .run();

  return json({ ok: true, commentId, status: nextStatus });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    if (url.pathname === '/health') {
      return withCors(request, env, json({ ok: true, service: 'comments-api-worker', missingEnv: validateEnv(env) }));
    }

    const publicCommentsMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/comments$/);
    if (request.method === 'GET' && publicCommentsMatch) {
      const slug = decodeURIComponent(publicCommentsMatch[1]);
      const comments = await listApprovedComments(env, slug, await getVisitorHash(request));
      return withCors(request, env, json({ ok: true, comments, maxDepth: MAX_DEPTH }));
    }

    if (request.method === 'POST' && publicCommentsMatch) {
      const payload = await parseJson<{
        authorName?: unknown;
        authorWebsite?: unknown;
        body?: unknown;
        postTitle?: unknown;
        postUrl?: unknown;
        turnstileToken?: unknown;
      }>(request);

      if (!payload) {
        return withCors(request, env, json({ ok: false, error: '评论数据格式不正确。' }, { status: 400 }));
      }

      const response = await createComment(env, request, decodeURIComponent(publicCommentsMatch[1]), payload);
      return withCors(request, env, response);
    }

    const likeMatch = url.pathname.match(/^\/api\/comments\/([^/]+)\/like$/);
    if (request.method === 'POST' && likeMatch) {
      const payload = await parseJson<{ liked?: unknown }>(request);
      if (!payload) {
        return withCors(request, env, json({ ok: false, error: '点赞数据格式不正确。' }, { status: 400 }));
      }

      const response = await toggleCommentLike(env, request, likeMatch[1], payload);
      return withCors(request, env, response);
    }

    const replyMatch = url.pathname.match(/^\/api\/comments\/([^/]+)\/replies$/);
    if (request.method === 'POST' && replyMatch) {
      const payload = await parseJson<{
        authorName?: unknown;
        authorWebsite?: unknown;
        body?: unknown;
        postTitle?: unknown;
        postUrl?: unknown;
        turnstileToken?: unknown;
        slug?: unknown;
      }>(request);

      if (!payload || typeof payload.slug !== 'string') {
        return withCors(request, env, json({ ok: false, error: '回复数据格式不正确。' }, { status: 400 }));
      }

      const response = await createComment(env, request, payload.slug, {
        ...payload,
        parentId: replyMatch[1]
      });
      return withCors(request, env, response);
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/login/github') {
      const state = createToken();
      const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
      authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_OAUTH_REDIRECT_URI);
      authorizeUrl.searchParams.set('scope', 'read:user');
      authorizeUrl.searchParams.set('state', state);

      return redirect(authorizeUrl.toString(), {
        headers: {
          'set-cookie': `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/callback') {
      const returnedState = url.searchParams.get('state');
      const storedState = getCookieValue(request.headers.get('cookie'), STATE_COOKIE);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        return redirect(`${env.ALLOWED_ADMIN_URL}?error=${encodeURIComponent(error)}`);
      }

      if (!returnedState || !storedState || returnedState !== storedState || !code) {
        return redirect(`${env.ALLOWED_ADMIN_URL}?error=${encodeURIComponent('oauth-state')}`);
      }

      try {
        const accessToken = await exchangeCodeForToken(code, env);
        const user = await fetchGitHubUser(accessToken);
        const allowlist = getAdminAllowlist(env);
        if (!allowlist.includes(user.login.toLowerCase())) {
          return redirect(`${env.ALLOWED_ADMIN_URL}?error=${encodeURIComponent('unauthorized')}`);
        }

        const { sessionToken } = await createAdminSession(env, user);
        const headers = new Headers();
        headers.append('set-cookie', `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
        headers.append('set-cookie', sessionCookie(sessionToken, 7 * 24 * 60 * 60));
        return redirect(env.ALLOWED_ADMIN_URL, { headers });
      } catch (oauthError) {
        const message = oauthError instanceof Error ? oauthError.message : 'unknown';
        return redirect(`${env.ALLOWED_ADMIN_URL}?error=${encodeURIComponent(message)}`);
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/session') {
      const session = await getAdminSession(request, env);
      if (!session) {
        return withCors(request, env, json({ ok: false, error: '未登录。' }, { status: 401 }));
      }
      return withCors(
        request,
        env,
        json({
          ok: true,
          admin: {
            login: session.githubLogin,
            name: session.displayName,
            avatarUrl: session.avatarUrl,
            expiresAt: session.expiresAt
          }
        })
      );
    }

    if (request.method === 'POST' && url.pathname === '/api/admin/logout') {
      await destroyAdminSession(request, env);
      return withCors(
        request,
        env,
        json(
          { ok: true },
          {
            headers: {
              'set-cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`
            }
          }
        )
      );
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/stats') {
      const session = await getAdminSession(request, env);
      if (!session) {
        return withCors(request, env, json({ ok: false, error: '未登录。' }, { status: 401 }));
      }
      const counts = await getAdminStats(env);
      return withCors(request, env, json({ ok: true, counts }));
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/comments') {
      const session = await getAdminSession(request, env);
      if (!session) {
        return withCors(request, env, json({ ok: false, error: '未登录。' }, { status: 401 }));
      }

      const status = normalizeStatus(url.searchParams.get('status'));
      const slug = url.searchParams.get('slug')?.trim() ?? '';
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
      const result = await listAdminComments(env, status, slug, Number.isFinite(page) ? page : 1, Number.isFinite(pageSize) ? pageSize : 20);
      return withCors(request, env, json({ ok: true, ...result }));
    }

    const moderateMatch = url.pathname.match(/^\/api\/admin\/comments\/([^/]+)$/);
    if (request.method === 'PATCH' && moderateMatch) {
      const session = await getAdminSession(request, env);
      if (!session) {
        return withCors(request, env, json({ ok: false, error: '未登录。' }, { status: 401 }));
      }

      const payload = await parseJson<{ action?: unknown }>(request);
      if (!payload || typeof payload.action !== 'string') {
        return withCors(request, env, json({ ok: false, error: '审核动作无效。' }, { status: 400 }));
      }

      const response = await moderateComment(env, moderateMatch[1], payload.action, session);
      return withCors(request, env, response);
    }

    return withCors(request, env, json({ ok: false, error: 'Not found' }, { status: 404 }));
  }
};
