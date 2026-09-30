describe("TypeScript combined regex injections", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-regex");
    await lumine.packages.activatePackage("language-typescript");
  });

  async function editorFor(text) {
    const editor = await lumine.workspace.open();
    editor.setGrammar(lumine.grammars.grammarForScopeName("source.ts"));
    editor.setText(text);
    await editor.languageMode.ready;
    await editor.languageMode.atTransactionEnd();
    return editor;
  }

  function regexLayers(editor) {
    return editor.languageMode
      .getAllInjectionLayers()
      .filter((layer) => layer.grammar.scopeName === "source.regexp");
  }

  function scopesAt(editor, needle) {
    const index = editor.getText().indexOf(needle);
    return editor
      .scopeDescriptorForBufferPosition(editor.getBuffer().positionForCharacterIndex(index))
      .getScopesArray();
  }

  it("combines valid patterns while isolating partial syntax", async () => {
    const editor = await editorFor(
      "const partial = /(?<name>/;\nconst safe = /x+/;\nconst other = /y*/;",
    );
    expect(regexLayers(editor).length).toBe(2);
    expect(scopesAt(editor, "const safe")).not.toContain("meta.group.capturing.named.regexp");
    expect(scopesAt(editor, "+")).toContain("keyword.operator.quantifier.regexp");
    const buffer = editor.getBuffer();
    const index = editor.getText().indexOf("(?<name>");
    buffer.setTextInRange(
      [buffer.positionForCharacterIndex(index), buffer.positionForCharacterIndex(index + 8)],
      "(?<name>x)",
    );
    await editor.languageMode.atTransactionEnd();
    expect(regexLayers(editor).length).toBe(1);
  });

  it("checks flags and restores the shared layer when an invalid flag is removed", async () => {
    const editor = await editorFor(
      "const partial = /x/gg;\nconst safe = /y+/;\nconst other = /z*/;",
    );
    expect(regexLayers(editor).length).toBe(2);
    const buffer = editor.getBuffer();
    const index = editor.getText().indexOf("gg");
    buffer.setTextInRange(
      [buffer.positionForCharacterIndex(index), buffer.positionForCharacterIndex(index + 2)],
      "g",
    );
    await editor.languageMode.atTransactionEnd();
    expect(regexLayers(editor).length).toBe(1);
  });

  it("keeps oversized patterns isolated without unbounded syntax validation", async () => {
    const editor = await editorFor(`const large = /${"a".repeat(17000)}/;\nconst safe = /x+/;`);
    expect(regexLayers(editor).length).toBe(2);
  });

  it("keeps legacy escapes and trailing backreferences out of the shared lexer stream", async () => {
    for (const separator of ["; const b = ", ";\nconst b = "]) {
      for (const [first, second] of [
        [String.raw`\x`, "41"],
        [String.raw`\c`, "A"],
        [String.raw`(a)\1`, "1"],
      ]) {
        const editor = await editorFor(
          `const a = /${first}/${separator}/${second}/; const safe = /z+/;`,
        );
        expect(regexLayers(editor).length).toBe(2);
        expect(scopesAt(editor, "const b")).not.toContain(
          "constant.character.escape.backslash.regexp",
        );
        editor.destroy();
      }
    }
  });

  it("isolates Unicode sets and unsupported group-name syntax", async () => {
    for (const literal of [String.raw`/[[a-z]--[aeiou]]/v`, "/(?<ż>a)/u", String.raw`/\k<ż>/`]) {
      const editor = await editorFor(`const a = ${literal}; const safe = /x+/;`);
      expect(regexLayers(editor).length).toBe(2);
      expect(scopesAt(editor, "const safe")).not.toContain("meta.group.capturing.named.regexp");
      editor.destroy();
    }
  });
});
