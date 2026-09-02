const fs = require("fs");
const path = require("path");

const highlightsPath = path.join(__dirname, "..", "grammars", "typescript-shared-highlights.scm");

describe("WASM Tree-sitter TypeScript grammar", () => {
  beforeEach(async () => {
    await lumine.packages.activatePackage("language-typescript");
  });

  describe("regular grammar", () => {
    it("passes grammar tests", async () => {
      await runGrammarTests(path.join(__dirname, "fixtures", "sample.ts"), /\/\//);
    });
  });

  describe("TSX grammar", () => {
    it("passes grammar tests", async () => {
      await runGrammarTests(path.join(__dirname, "fixtures", "sample.tsx"), /\/\//);
    });
  });

  it("injects the shared Tree-sitter regex grammar", async () => {
    await lumine.packages.activatePackage("language-regex");

    const grammar = lumine.grammars.grammarForScopeName("source.ts");
    const editor = await lumine.workspace.open();
    editor.setGrammar(grammar);
    editor.setText("const pattern: RegExp = /^([a-z]+)$/;");

    const languageMode = editor.getBuffer().getLanguageMode();
    await languageMode.ready;
    await languageMode.atTransactionEnd();

    const scopesAt = (needle) => {
      const index = editor.getText().indexOf(needle);
      const point = editor.getBuffer().positionForCharacterIndex(index);
      return editor.scopeDescriptorForBufferPosition(point).getScopesArray();
    };

    expect(scopesAt("^")).toContain("keyword.control.anchor.regexp");
    expect(scopesAt("+")).toContain("keyword.operator.quantifier.regexp");
    expect(scopesAt("$")).toContain("keyword.control.anchor.regexp");
  });

  it("roots enum, shorthand-property, and generic-delimiter captures on leaf nodes", () => {
    const query = fs.readFileSync(highlightsPath, "utf8");

    expect(query).not.toContain("(enum_body\n  name: (property_identifier)");
    expect(query).not.toContain("(object\n  (shorthand_property_identifier)");
    expect(query).not.toMatch(/\((?:type_arguments|type_parameters) ["<>]/);
    expect(query).toContain("(#is? test.childOfType enum_body)");
    expect(query).toContain("(#is? test.childOfType object)");
    expect(query).toContain("(#is? test.childOfType type_arguments)");
    expect(query).toContain("(#is? test.childOfType type_parameters)");
  });
});
