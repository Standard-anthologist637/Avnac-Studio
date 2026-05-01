// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { shouldIgnoreEditorHotkeys } from "./scene-editor-input-utils";

describe("shouldIgnoreEditorHotkeys", () => {
  it("ignores text-entry targets", () => {
    const input = document.createElement("input");
    expect(shouldIgnoreEditorHotkeys(input, false)).toBe(true);

    const textarea = document.createElement("textarea");
    expect(shouldIgnoreEditorHotkeys(textarea, false)).toBe(true);

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(shouldIgnoreEditorHotkeys(editable, false)).toBe(true);
  });

  it("does not ignore general editor chrome", () => {
    const chromeButton = document.createElement("button");
    chromeButton.setAttribute("data-avnac-chrome", "true");
    expect(shouldIgnoreEditorHotkeys(chromeButton, false)).toBe(false);
  });

  it("ignores all shortcuts during inline text editing", () => {
    const chromeButton = document.createElement("button");
    chromeButton.setAttribute("data-avnac-chrome", "true");
    expect(shouldIgnoreEditorHotkeys(chromeButton, true)).toBe(true);
  });
});
