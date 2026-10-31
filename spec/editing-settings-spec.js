const path = require("node:path");

describe("typescript editing settings", () => {
  let editor;

  beforeEach(async () => {
    jasmine.useRealClock();
    const pack = await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
    await pack.resourceLoadPromise;
    editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.ts"));
    editor.update({ autoIndent: false });
    await editor.whenGrammarSettled();
  });

  afterEach(() => editor?.destroy());

  async function setText(text) {
    editor.setText(text);
    expect(await editor.whenGrammarSettled()).toBe(true);
  }

  it("selects dollar-prefixed and private names in both TypeScript dialects", async () => {
    for (const scope of ["source.ts", "source.tsx"]) {
      editor.setGrammar(lumine.grammars.grammarForScopeName(scope));
      await setText("const $value = 1;");
      editor.setCursorBufferPosition(
        editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf("value") + 1),
      );
      editor.selectWordsContainingCursors();
      expect(editor.getSelectedText()).toBe("$value");
      await setText("class Value { #privateName = 1; }");
      editor.setCursorBufferPosition(
        editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf("privateName") + 1),
      );
      editor.selectWordsContainingCursors();
      expect(editor.getSelectedText()).toBe("#privateName");
    }
  });

  it("keeps explicit user word-boundary overrides authoritative", async () => {
    lumine.config.set("editor.nonWordCharacters", "$#-", { scopeSelector: ".source.ts" });
    try {
      await setText("$value");
      editor.setCursorBufferPosition(
        editor.getBuffer().positionForCharacterIndex(editor.getText().indexOf("value") + 1),
      );
      editor.selectWordsContainingCursors();
      expect(editor.getSelectedText()).toBe("value");
    } finally {
      lumine.config.unset("editor.nonWordCharacters", { scopeSelector: ".source.ts" });
    }
  });

  it("uses native JSX comments for markup rows and whole expression rows", async () => {
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.tsx"));
    for (const text of ["hello", "{value}"]) {
      const source = "const node = (\n  <div>\n    " + text + "\n  </div>\n);";
      await setText(source);
      editor.setCursorBufferPosition([2, 4]);
      const delimiters = await editor.getCommentDelimitersForBufferPosition([2, 4]);
      expect(delimiters.line).toBeUndefined();
      expect(delimiters.block).toEqual(["{/*", "*/}"]);
      await editor.toggleLineCommentsInSelection();
      await editor.whenGrammarSettled();
      expect(editor.lineTextForBufferRow(2).trim()).toMatch(/^\{\/\*/);
      expect(editor.languageMode.tree.rootNode.hasError).toBe(false);
      await editor.toggleLineCommentsInSelection();
      expect(editor.getText()).toBe(source);
    }
  });

  it("uses ordinary JavaScript comments for code rows inside JSX braces", async () => {
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.tsx"));
    const source = "const node = (\n  <div prop={\n    value\n  } />\n);";
    await setText(source);
    editor.setCursorBufferPosition([2, 6]);
    const delimiters = await editor.getCommentDelimitersForBufferPosition([2, 6]);
    expect(delimiters.line).toBe("//");
    expect(delimiters.block).toEqual(["/*", "*/"]);
    await editor.toggleLineCommentsInSelection();
    await editor.whenGrammarSettled();
    expect(editor.lineTextForBufferRow(2)).toBe("    // value");
    expect(editor.languageMode.tree.rootNode.hasError).toBe(false);
    await editor.toggleLineCommentsInSelection();
    expect(editor.getText()).toBe(source);
  });

  it("recognizes explicit TypeScript runners without guessing ambiguous interpreters", async () => {
    const grammar = editor.getGrammar();
    for (const text of [
      "#!/usr/bin/ts-node",
      "#!/usr/bin/env -S ts-node --esm\nrun()",
      "#!/usr/bin/env ts-node-esm\nrun()",
      "#!/usr/bin/env tsx\nrun()",
      "#! /opt/tsx --test",
      "#!/usr/bin/env /opt/tsx",
      "#!/usr/bin/env -S /opt/tsx --test",
    ]) {
      expect(lumine.grammars.grammarMatchesPrefix(grammar, text)).withContext(text).toBe(true);
      expect(lumine.grammars.selectGrammar("extensionless-runner", text).scopeName)
        .withContext(text)
        .toBe("source.ts");
    }
    for (const text of [
      "#!/usr/bin/env node\nrun()",
      "#!/usr/bin/env bun\nrun()",
      "#!/usr/bin/env tsx-helper\nrun()",
      "#!/usr/bin/python /tmp/tsx",
      "#!/usr/bin/env printf tsx",
      "#!/bin/sh -c 'echo tsx '",
      "#!/usr/bin/env -S printf /tmp/tsx",
      "#!/usr/bin/env tsx-helper tsx",
      "#!/usr/bin/env tsx.exe",
      "#!/usr/bin/env ts-node.exe",
      "#!/usr/bin/env bun.exe",
      "#!/usr/bin/env deno.exe",
    ]) {
      expect(lumine.grammars.grammarMatchesPrefix(grammar, text)).withContext(text).toBe(false);
      expect(lumine.grammars.selectGrammar("extensionless-runner", text).scopeName)
        .withContext(text)
        .not.toBe("source.ts");
    }
  });

  it("preserves filename and explicit user associations independently of shebang arguments", async () => {
    const text = "#!/usr/bin/python /tmp/tsx";
    expect(lumine.grammars.selectGrammar("explicit.ts", text).scopeName).toBe("source.ts");
    const previous = lumine.config.get("core.customFileTypes");
    lumine.config.set("core.customFileTypes", { ...previous, "source.ts": ["user-runner"] });
    try {
      expect(lumine.grammars.selectGrammar("explicit.user-runner", text).scopeName).toBe(
        "source.ts",
      );
    } finally {
      if (previous === undefined) lumine.config.unset("core.customFileTypes");
      else lumine.config.set("core.customFileTypes", previous);
    }
  });

  it("keeps code comment metadata before final lexical captures on TSX constant leaves", async () => {
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.tsx"));
    for (const value of ["Infinity", "undefined", "null"]) {
      const source = `const node = (\n  <div>{\n    ${value}\n  }</div>\n);`;
      await setText(source);
      editor.setCursorBufferPosition([2, 5]);
      const scopes = editor.scopeDescriptorForBufferPosition([2, 5]).getScopesArray();
      expect(scopes).toContain("meta.embedded.code.ts.tsx");
      if (value === "Infinity") expect(scopes).toContain("constant.language.infinity.ts.tsx");
      expect((await editor.getCommentDelimitersForBufferPosition([2, 5])).line).toBe("//");
      await editor.toggleLineCommentsInSelection();
      await editor.whenGrammarSettled();
      expect(editor.lineTextForBufferRow(2)).toBe(`    // ${value}`);
      expect(editor.languageMode.tree.rootNode.hasError).toBe(false);
      await editor.toggleLineCommentsInSelection();
      expect(editor.getText()).toBe(source);
    }
  });

  it("pairs TypeScript syntax without introducing prose smart quotes in either dialect", async () => {
    await lumine.packages.activatePackage("bracket-matcher");
    for (const scope of ["source.ts", "source.tsx"]) {
      editor.setGrammar(lumine.grammars.grammarForScopeName(scope));
      for (const [typed, expected] of [
        ["(", "()"],
        ["[", "[]"],
        ["{", "{}"],
        ['"', '""'],
        ["'", "''"],
        ["`", "``"],
        ["“", "“"],
      ]) {
        await setText("");
        await editor.insertText(typed);
        await editor.whenGrammarSettled();
        expect(editor.getText())
          .withContext(scope + typed)
          .toBe(expected);
      }
    }
  });
});
