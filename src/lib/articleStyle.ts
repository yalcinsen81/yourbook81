export function articleStyle(article?: string): string {
  if (!article) return "";
  const value = article.trim().toLowerCase();
  if (["der", "das", "il", "lo", "el", "le"].includes(value)) {
    return value === "das" ? "article-neut" : "article-masc";
  }
  if (["die", "la"].includes(value)) return "article-fem";
  return "";
}
