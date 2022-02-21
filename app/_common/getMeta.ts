import type { MetaFunction } from "remix";

const getMeta =
  ({
    title: pageTitle,
    description = "",
    img = "",
  }: {
    title: string;
    description?: string;
    img?: string;
  }): MetaFunction =>
  () => {
    const title = `${pageTitle} | Constancy`;
    return {
      title,
      description,
      "og:title": title,
      "og:description": description,
      "twitter:title": title,
      "twitter:description": description,
      "og:image": img,
      "twitter:image": img,
    };
  };

export default getMeta;