interface Env {
  ALLOWED_ADMIN_URL: string;
  ALLOWED_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  OAUTH_REDIRECT_URI: string;
}

const STATE_COOKIE = 'decap-oauth-state';

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers
    }
  });
}

function html(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...init.headers
    }
  });
}

function createState() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCookieValue(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${key}=`));
  return match ? decodeURIComponent(match.slice(key.length + 1)) : null;
}

function errorPage(message: string, details?: string) {
  return html(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OAuth 登录失败</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #09090b; color: #fafafa; font: 16px/1.7 Inter, system-ui, sans-serif; padding: 24px; }
      main { max-width: 680px; background: #18181b; border: 1px solid rgba(255,255,255,.08); border-radius: 24px; padding: 24px; }
      h1 { margin-top: 0; font-size: 24px; }
      p, code { word-break: break-word; }
    </style>
  </head>
  <body>
    <main>
      <h1>GitHub 登录失败</h1>
      <p>${message}</p>
      ${details ? `<p><code>${details}</code></p>` : ''}
    </main>
  </body>
</html>`, { status: 400 });
}

function successPage(token: string, adminUrl: string, allowedOrigin: string) {
  return html(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OAuth 登录成功</title>
  </head>
  <body>
    <script>
      const auth = ${JSON.stringify({ token: '__TOKEN__' })};
      auth.token = ${JSON.stringify(token)};
      const adminUrl = ${JSON.stringify(adminUrl)};
      const allowedOrigin = ${JSON.stringify(allowedOrigin)};

      const sendSuccess = () => {
        if (!window.opener) return;
        window.opener.postMessage('authorization:github:success:' + JSON.stringify(auth), allowedOrigin);
        window.close();
      };

      window.addEventListener('message', (event) => {
        if (event.origin !== allowedOrigin) return;
        sendSuccess();
      }, false);

      if (window.opener) {
        window.opener.postMessage('authorizing:github', allowedOrigin);
        setTimeout(sendSuccess, 100);
      } else {
        location.replace(adminUrl);
      }
    </script>
  </body>
</html>`);
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
      redirect_uri: env.OAUTH_REDIRECT_URI
    })
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? 'Missing access token');
  }

  return data.access_token;
}

function validateEnv(env: Env) {
  const missing = [
    ['GITHUB_CLIENT_ID', env.GITHUB_CLIENT_ID],
    ['GITHUB_CLIENT_SECRET', env.GITHUB_CLIENT_SECRET],
    ['OAUTH_REDIRECT_URI', env.OAUTH_REDIRECT_URI],
    ['ALLOWED_ORIGIN', env.ALLOWED_ORIGIN],
    ['ALLOWED_ADMIN_URL', env.ALLOWED_ADMIN_URL]
  ].filter(([, value]) => !value || value.includes('<your-'));

  return missing.map(([key]) => key);
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const missingEnv = validateEnv(env);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'decap-oauth-worker', missingEnv });
    }

    if (missingEnv.length > 0) {
      return json({ ok: false, error: 'Missing required environment variables', missingEnv }, { status: 500 });
    }

    if (url.pathname === '/auth') {
      const state = createState();
      const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
      authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set('redirect_uri', env.OAUTH_REDIRECT_URI);
      authorizeUrl.searchParams.set('scope', 'repo');
      authorizeUrl.searchParams.set('state', state);

      return new Response(null, {
        status: 302,
        headers: {
          location: authorizeUrl.toString(),
          'set-cookie': `${STATE_COOKIE}=${encodeURIComponent(state)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    if (url.pathname === '/callback') {
      const returnedState = url.searchParams.get('state');
      const storedState = getCookieValue(request.headers.get('cookie'), STATE_COOKIE);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        return errorPage('GitHub 拒绝了授权请求。', errorDescription ?? error);
      }

      if (!returnedState || !storedState || returnedState !== storedState) {
        return errorPage('OAuth state 校验失败，请重新发起登录。');
      }

      if (!code) {
        return errorPage('缺少 GitHub 返回的 code，无法继续登录。');
      }

      try {
        const token = await exchangeCodeForToken(code, env);
        return new Response(successPage(token, env.ALLOWED_ADMIN_URL, env.ALLOWED_ORIGIN).body, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'set-cookie': `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
          }
        });
      } catch (exchangeError) {
        const message = exchangeError instanceof Error ? exchangeError.message : 'Unknown token exchange error';
        return errorPage('GitHub token 交换失败。', message);
      }
    }

    return json({ ok: false, error: 'Not found' }, { status: 404 });
  }
};
