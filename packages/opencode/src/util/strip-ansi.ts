// ANSI escape sequence regex (equivalent to ansi-regex v6)
// Matches: CSI sequences, OSC sequences (terminated by BEL or ST), and other common escapes
const ansiRegex =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g

export function stripAnsi(s: string): string {
  return s.replace(ansiRegex, "")
}
