export type TocItem = {
  depth: 2 | 3;
  slug: string;
  text: string;
};

export function getTocFromHeadings(headings: { depth: number; slug: string; text: string }[]) {
  return headings.filter((heading): heading is TocItem => (heading.depth === 2 || heading.depth === 3) && Boolean(heading.slug && heading.text));
}
