export function extractChecklistItems(text: string, options: { includeChecked?: boolean } = {}) {
  const pattern = options.includeChecked ? /^[-*]\s*\[[ xX]\]\s+/ : /^[-*]\s*\[\s\]\s+/
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => pattern.test(line))
    .map((line) => line.replace(pattern, "").trim())
    .filter(Boolean)
}
