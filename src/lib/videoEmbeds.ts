export type VideoEmbed = {
  provider: 'youtube' | 'bilibili' | 'cloudflare-stream' | 'r2';
  mode: 'iframe' | 'video';
  url: string;
  label: string;
};

const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
const bilibiliIdPattern = /^BV[a-zA-Z0-9]{10}$/;
const cloudflareStreamIdPattern = /^[a-fA-F0-9]{32}$/;
const videoFilePattern = /\.(mp4|webm|mov|m4v)(\?.*)?$/i;

export function parseVideoEmbed(value: string): VideoEmbed | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  if (hostname === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (!youtubeIdPattern.test(id)) return null;
    return {
      provider: 'youtube',
      mode: 'iframe',
      url: `https://www.youtube.com/embed/${id}`,
      label: 'YouTube 视频'
    };
  }

  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    const watchId = url.searchParams.get('v') ?? '';
    const embedId = url.pathname.startsWith('/embed/') ? url.pathname.split('/').filter(Boolean)[1] ?? '' : '';
    const id = watchId || embedId;
    if (!youtubeIdPattern.test(id)) return null;
    return {
      provider: 'youtube',
      mode: 'iframe',
      url: `https://www.youtube.com/embed/${id}`,
      label: 'YouTube 视频'
    };
  }

  if (hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) {
    const id = url.pathname.split('/').find((part) => bilibiliIdPattern.test(part)) ?? '';
    if (!id) return null;
    return {
      provider: 'bilibili',
      mode: 'iframe',
      url: `https://player.bilibili.com/player.html?bvid=${id}&autoplay=0`,
      label: 'Bilibili 视频'
    };
  }

  if (hostname === 'iframe.videodelivery.net' || hostname === 'customer-vod.cloudflarestream.com') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    if (!cloudflareStreamIdPattern.test(id)) return null;
    return {
      provider: 'cloudflare-stream',
      mode: 'iframe',
      url: `https://iframe.videodelivery.net/${id}`,
      label: 'Cloudflare Stream 视频'
    };
  }

  if ((hostname.endsWith('.r2.dev') || hostname.includes('.r2.cloudflarestorage.com')) && videoFilePattern.test(url.pathname)) {
    return {
      provider: 'r2',
      mode: 'video',
      url: url.toString(),
      label: '外部视频'
    };
  }

  return null;
}

export function renderVideoEmbedHtml(embed: VideoEmbed) {
  const wrapperClass = 'video-embed';
  if (embed.mode === 'video') {
    return `<figure class="${wrapperClass}" data-provider="${embed.provider}"><video controls preload="metadata" src="${embed.url}"></video><figcaption>${embed.label}</figcaption></figure>`;
  }

  const allow = embed.provider === 'youtube'
    ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    : 'autoplay; fullscreen; picture-in-picture';

  return `<figure class="${wrapperClass}" data-provider="${embed.provider}"><iframe src="${embed.url}" title="${embed.label}" loading="lazy" allow="${allow}" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><figcaption>${embed.label}</figcaption></figure>`;
}
