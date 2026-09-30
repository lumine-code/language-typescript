const path = require("path");

describe("TypeScript symbol queries", () => {
  let pack;
  let editor;

  beforeEach(async () => {
    pack = await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
  });

  afterEach(() => editor?.destroy());

  for (const scopeName of ["source.ts", "source.tsx"]) {
    it(`keeps ${scopeName} arrow-function symbols independent of preceding comments`, async () => {
      const grammar = pack.grammars.find((item) => item.scopeName === scopeName);
      const source = `${Array.from({ length: 3000 }, (_, i) => `// documentation ${i}\n`).join("")}const value = () => {};`;
      const query = await grammar.getQuery("tagsQuery");
      const parser = grammar.createParser(await grammar.getLanguage());
      const tree = parser.parse(source);
      try {
        expect(tree.rootNode.hasError).toBe(false);
        expect(
          query.captures(tree.rootNode, {
            startPosition: { row: 1500, column: 0 },
            endPosition: { row: 1506, column: 0 },
          }),
        ).toEqual([]);
        expect(query.didExceedMatchLimit()).toBe(false);
      } finally {
        tree.delete();
        parser.delete();
      }
      editor = await lumine.workspace.open();
      editor.setGrammar(grammar);
      editor.setText(source);
      const groups = await editor.getGrammarQueryCaptureGroups("tagsQuery");
      const captures = groups.find((group) => group.grammar === grammar).captures;
      expect(captures.map(({ name }) => name)).toEqual(["definition.function", "name"]);
      expect(captures.find(({ name }) => name === "name").node.text).toBe("value");
    });
  }

  it("preserves TypeScript declarations and their explicit symbol kinds", async () => {
    const grammar = pack.grammars.find(({ scopeName }) => scopeName === "source.ts");
    editor = await lumine.workspace.open();
    editor.setGrammar(grammar);
    editor.setText(
      "// module documentation\nmodule Scope {}\ninterface Shape {}\nclass Example { method() {} }\nfunction declared() {}\nconst arrow = () => {};",
    );
    const groups = await editor.getGrammarQueryCaptureGroups("tagsQuery");
    const captures = groups.find((group) => group.grammar === grammar).captures;
    const names = captures.filter(({ name }) => name === "name");
    expect(names.map(({ node }) => node.text)).toEqual([
      "Scope",
      "Shape",
      "Example",
      "method",
      "declared",
      "arrow",
    ]);
    expect(names.slice(0, 5).map(({ setProperties }) => setProperties["symbol.tag"])).toEqual([
      "module",
      "interface",
      "class",
      "method",
      "function",
    ]);
  });
});
