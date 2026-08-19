/**
 * WeChat Native Text Formatter & Long Text Document Converter.
 * Tailored specifically for small phone screens: clean layout, emojis, readable lists,
 * neat section headers, and intelligent semantic splitting for long responses.
 */

export class WeChatFormatter {
  /**
   * Transforms markdown and rich-text responses into clear, thumb-friendly mobile text.
   */
  public static format(text: string): string {
    if (!text) return '';

    let res = text;

    // 1. Remove internal protocol tags
    res = res.replace(/\[SYSTEM INSTRUCTION[\s\S]*?\[END SYSTEM INSTRUCTION\]/gi, '');
    res = res.replace(/\[FILE_OUTPUT:\s*([^\]]+)\]/gi, '📎 已为您推送文件卡片: $1');
    res = res.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
    res = res.replace(/<details>[\s\S]*?<\/details>/gi, '');

    // 2. Format Headings to clear mobile titles with emoji bullets
    res = res.replace(/^#{1}\s+(.+)$/gm, '🌟【$1】');
    res = res.replace(/^#{2}\s+(.+)$/gm, '📌【$1】');
    res = res.replace(/^#{3,6}\s+(.+)$/gm, '🔹 $1');

    // 3. Bold text cleanup -> clean emphasis for mobile reading
    res = res.replace(/\*\*(.+?)\*\*/g, '$1');
    res = res.replace(/__(.+?)__/g, '$1');

    // 4. Inline code -> simple clean quotes
    res = res.replace(/`([^`\n]+)`/g, '「$1」');

    // 5. Code blocks: keep neat
    res = res.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, (match, p1) => {
      const trimmed = p1.trim();
      return `\n💻 代码片段:\n${trimmed}\n`;
    });

    // 6. Horizontal Rules -> sleek mobile line
    res = res.replace(/^(?:---|===|___|\*\*\*)\s*$/gm, '──────────────');

    // 7. Bullet lists: clean up hyphens/stars to mobile bullets
    res = res.replace(/^[\*\-]\s+/gm, '• ');

    // 8. Trim extra empty spaces and trailing lines
    res = res.replace(/\n{3,}/g, '\n\n');

    return res.trim();
  }

  /**
   * Chunks long text safely under max character limits (e.g. 1800 chars for WeChat).
   */
  public static splitIntoChunks(text: string, maxLen = 1800): string[] {
    if (text.length <= maxLen) return [text];

    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let current = '';

    for (const p of paragraphs) {
      if ((current + '\n\n' + p).length <= maxLen) {
        current = current ? current + '\n\n' + p : p;
      } else {
        if (current) chunks.push(current);
        if (p.length > maxLen) {
          let sub = p;
          while (sub.length > maxLen) {
            chunks.push(sub.slice(0, maxLen));
            sub = sub.slice(maxLen);
          }
          current = sub;
        } else {
          current = p;
        }
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }
}
