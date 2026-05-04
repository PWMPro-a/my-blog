import { parseVideoEmbed, type VideoEmbed } from './videoEmbeds';

type ElementNode = {
  type: 'element';
  tagName: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

type TextNode = {
  type: 'text';
  value: string;
};

type HastNode = ElementNode | TextNode;

type ParentNode = {
  children?: HastNode[];
};

function getStandaloneText(node: ElementNode) {
  if (node.tagName !== 'p' || !node.children?.length) return '';
  if (!node.children.every((child) => child.type === 'text')) return '';
  return node.children.map((child) => child.value).join('').trim();
}

function createEmbedNode(embed: VideoEmbed): ElementNode {
  const mediaNode: ElementNode = embed.mode === 'video'
    ? {
        type: 'element',
        tagName: 'video',
        properties: {
          controls: true,
          preload: 'metadata',
          src: embed.url
        },
        children: []
      }
    : {
        type: 'element',
        tagName: 'iframe',
        properties: {
          src: embed.url,
          title: embed.label,
          loading: 'lazy',
          allow: embed.provider === 'youtube'
            ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
            : 'autoplay; fullscreen; picture-in-picture',
          referrerPolicy: 'strict-origin-when-cross-origin',
          allowFullScreen: true
        },
        children: []
      };

  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['video-embed'],
      dataProvider: embed.provider
    },
    children: [
      mediaNode,
      {
        type: 'element',
        tagName: 'figcaption',
        properties: {},
        children: [{ type: 'text', value: embed.label }]
      }
    ]
  };
}

function visit(node: ParentNode) {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.type !== 'element') return child;

    const text = getStandaloneText(child);
    const embed = text ? parseVideoEmbed(text) : null;
    if (embed) return createEmbedNode(embed);

    visit(child);
    return child;
  });
}

export default function rehypeVideoEmbeds() {
  return (tree: ParentNode) => {
    visit(tree);
  };
}
