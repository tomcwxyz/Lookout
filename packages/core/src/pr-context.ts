/** Extract useful PR evidence without treating author claims as verified. */
export type PullRequestContext = {
  summary: string | null; changes: string[]; remaining: string[];
  testing: string[]; risks: string[]; discussion: string[];
};
function plain(line: string): string {
  return line.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\(([^)]*)\)/g, "$1")
    .replace(/\x60/g, "").replace(/<\/?[^>]+>/g, " ")
    .replace(/\*\*|__/g, "").replace(/\s+/g, " ").trim().slice(0, 250);
}
function heading(section: string): "changes" | "testing" | "remaining" | "risks" | "summary" {
  if (/\b(test|qa|verify|verification|checks|validation)\b/i.test(section)) return "testing";
  if (/\b(follow.?up|remaining|next steps?|to.?do|todo|outstanding|pending|before merge|known limitations?|not done)\b/i.test(section)) return "remaining";
  if (/\b(risk|caveat|blocker|issue|concern)\b/i.test(section)) return "risks";
  if (/\b(what changed|changes|implemented|implementation|delivered|features?|work done|highlights)\b/i.test(section)) return "changes";
  return "summary";
}
function append(items: string[], content: string, limit = 4) {
  if (content && items.length < limit && !items.includes(content)) items.push(content);
}
export function parsePullRequestContext(
  body: string | null | undefined,
  comments: ReadonlyArray<{ author: string; body: string; createdAt: string }> = []
): PullRequestContext {
  const result: PullRequestContext = { summary: null, changes: [], remaining: [], testing: [], risks: [], discussion: [] };
  if (body) {
    let section: ReturnType<typeof heading> = "summary";
    let inCode = false, inComment = false;
    for (const raw of body.slice(0, 14000).split(/\r?\n/).slice(0, 150)) {
      const line = raw.trim();
      if (/^(\x60{3}|~~~)/.test(line)) { inCode = !inCode; continue; }
      if (inCode) continue;
      if (line.includes("<!--")) inComment = true;
      if (inComment) { if (line.includes("-->")) inComment = false; continue; }
      const title = line.match(/^#{1,5}\s+(.+)$/) ??
        line.match(/^\*\*(Summary|What changed|Changes|Testing|Follow-up|Remaining|Known issues|Risk|Next steps):?\*\*$/i);
      if (title) { section = heading(title[1] ?? ""); continue; }
      const task = line.match(/^[-*]\s+\[([xX ])\]\s+(.+)$/);
      const statement = plain(task?.[2] ?? line.replace(/^[-*]\s+|^\d+\.\s+|^>\s+/, ""));
      if (statement.length < 6 || /^(-{3,}|\|.*\|)$/.test(line) || /^https?:\/\//.test(statement)) continue;
      if (task) {
        if (task[1] === " ") append(result.remaining, statement, 6);
        else if (section === "testing") append(result.testing, "PR marks complete: " + statement, 4);
        else append(result.changes, "PR marks complete: " + statement, 4);
      } else if (section === "testing") append(result.testing, statement);
      else if (section === "remaining") append(result.remaining, statement, 6);
      else if (section === "risks") append(result.risks, statement);
      else if (section === "changes") append(result.changes, statement);
      else if (!result.summary && !/^[#>|]/.test(line)) result.summary = statement;
    }
  }
  for (const comment of comments.slice(-3)) {
    const first = comment.body.split(/\r?\n/).map(plain).find(s => s.length >= 10);
    if (first) append(result.discussion, comment.author + ": " + first, 3);
  }
  return result;
}
