import { describe, expect, it } from "bun:test"
import { extractChecklistItems } from "./tasks-checklist"

describe("extractChecklistItems", () => {
  it("returns only unchecked items by default", () => {
    expect(extractChecklistItems("- [ ] one\n- [x] two\n* [ ] three")).toEqual(["one", "three"])
  })

  it("includes checked items when requested", () => {
    expect(extractChecklistItems("- [ ] one\n- [x] two\n- [X] three", { includeChecked: true })).toEqual([
      "one",
      "two",
      "three",
    ])
  })
})
