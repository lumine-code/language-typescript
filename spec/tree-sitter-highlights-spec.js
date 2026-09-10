const fs = require("fs");
const path = require("path");
const { Point } = require("lumine");

const HIGHLIGHTS_PATH = path.join(__dirname, "..", "grammars", "typescript-shared-highlights.scm");

describe("TypeScript Tree-sitter highlights", () => {
  let editor;
  let languageMode;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-typescript");
  });

  afterEach(() => editor?.destroy());

  async function setUp(text, fileName = "highlights.ts") {
    editor = await lumine.workspace.open(fileName);
    editor.setText(text);
    languageMode = editor.getBuffer().languageMode;
    await languageMode.ready;
  }

  function indexOfOccurrence(needle, occurrence = 0) {
    const text = editor.getText();
    let index = -1;
    for (let count = 0; count <= occurrence; count++) {
      index = text.indexOf(needle, index + 1);
    }
    expect(index).not.toBe(-1);
    return index;
  }

  function scopesIn(needle, offset = 0, occurrence = 0) {
    const index = indexOfOccurrence(needle, occurrence) + offset;
    const point = editor.getBuffer().positionForCharacterIndex(index);
    return editor.scopeDescriptorForBufferPosition(point).getScopesArray();
  }

  function rawCaptures(startRow, endRow) {
    const layer = languageMode.rootLanguageLayer;
    const options =
      startRow == null
        ? undefined
        : {
            startPosition: new Point(startRow, 0),
            endPosition: new Point(endRow, 0),
          };
    return layer.queries.highlightsQuery.captures(layer.tree.rootNode, options);
  }

  function expectDelimiterScopes(needle, beginScope, endScope, occurrence = 0) {
    const openingScopes = scopesIn(needle, 0, occurrence);
    const closingScopes = scopesIn(needle, needle.length - 1, occurrence);

    expect(openingScopes).toContain(beginScope);
    expect(openingScopes).not.toContain(endScope);
    expect(closingScopes).toContain(endScope);
    expect(closingScopes).not.toContain(beginScope);
  }

  it("preserves enum, object, generic, string, template, and regex scopes", async () => {
    await setUp(
      [
        "enum Status { Ready, Done = 1 }",
        "const item = 1;",
        "const object = { item };",
        "function identity<T, U>(value: T): U { return value as unknown as U; }",
        "const result = identity<T, U>(item);",
        'const doubleValue = "value";',
        'const emptyDouble = "";',
        "const singleValue = 'value';",
        "const emptySingle = '';",
        "const templateValue = `value ${item}`;",
        "const emptyTemplate = ``;",
        "type Label = `value-${Status}`;",
        "type EmptyLabel = ``;",
        "const pattern = /value+/gi;",
        "// comment",
        "const next = true;",
      ].join("\r\n"),
    );

    expect(scopesIn("Ready")).toContain("variable.declaration.enum.ts");
    expect(scopesIn("Done")).toContain("variable.declaration.enum.ts");
    expect(scopesIn("{ item }", 2)).toContain("entity.other.attribute-name.shorthand.ts");

    for (const occurrence of [0, 1]) {
      expect(scopesIn("<T, U>", 0, occurrence)).toContain(
        "punctuation.definition.parameters.begin.bracket.angle.ts",
      );
      expect(scopesIn("<T, U>", 5, occurrence)).toContain(
        "punctuation.definition.parameters.end.bracket.angle.ts",
      );
    }

    expectDelimiterScopes(
      '"value"',
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      '""',
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      "'value'",
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      "''",
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      "`value ${item}`",
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      "``",
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );
    expectDelimiterScopes(
      "`value-${Status}`",
      "punctuation.delimiter.string.begin.ts",
      "punctuation.delimiter.string.end.ts",
    );
    expect(scopesIn("${Status}")).toContain("punctuation.section.embedded.begin.ts");
    expect(scopesIn("${Status}", 2)).toContain("meta.embedded.line.interpolation.ts");
    expectDelimiterScopes(
      "``",
      "punctuation.delimiter.string.begin.ts",
      "punctuation.delimiter.string.end.ts",
      1,
    );
    expectDelimiterScopes(
      "/value+/",
      "punctuation.definition.string.begin.ts",
      "punctuation.definition.string.end.ts",
    );

    expect(scopesIn("const next")).not.toContain("comment.line.double-slash.ts");
  });

  it("returns local closing captures when multiline parents start before the query range", async () => {
    await setUp(
      [
        "const result = factory<",
        "  Alpha,",
        "  Beta,",
        "  Gamma",
        ">();",
        "const message = `start",
        "middle",
        "end`;",
      ].join("\n"),
    );

    const typeCaptures = rawCaptures(2, 5).filter(
      (capture) => capture.name.startsWith("punctuation.") && capture.name.includes(".parameters."),
    );
    expect(
      typeCaptures.every(
        (capture) => capture.node.startPosition.row >= 2 && capture.node.startPosition.row < 5,
      ),
    ).toBe(true);
    expect(
      typeCaptures.some(
        (capture) =>
          capture.name === "punctuation.definition.parameters.end.bracket.angle.ts" &&
          capture.node.startPosition.row === 4,
      ),
    ).toBe(true);

    const templateCaptures = rawCaptures(6, 8).filter((capture) =>
      capture.name.startsWith("punctuation.definition.string."),
    );
    expect(
      templateCaptures.every(
        (capture) => capture.node.startPosition.row >= 6 && capture.node.startPosition.row < 8,
      ),
    ).toBe(true);
    expect(
      templateCaptures.some(
        (capture) =>
          capture.name === "punctuation.definition.string.end.ts" &&
          capture.node.startPosition.row === 7,
      ),
    ).toBe(true);
  });

  it("keeps large destructuring patterns locally rooted", async () => {
    await setUp("function generated({ key, fallback = 1, ...rest }) {}");
    expect(scopesIn("key")).toContain("variable.parameter.destructuring.ts");
    expect(scopesIn("fallback")).toContain("variable.parameter.destructuring.with-default.ts");
    expect(scopesIn("rest")).toContain("variable.parameter.destructuring.rest.ts");

    await setUp(
      "const { key: alias, shorthand, fallback: defaulted = 1 } = source;\n" +
        "const [first, second = 2] = values;",
    );
    expect(scopesIn("key")).toContain("entity.other.attribute-name.ts");
    expect(scopesIn("alias")).toContain("variable.other.assignment.destructuring.ts");
    expect(scopesIn("shorthand")).toContain("variable.other.assignment.destructuring.ts");
    expect(scopesIn("defaulted")).toContain("variable.other.assignment.destructuring.ts");
    expect(scopesIn("first")).toContain("variable.other.assignment.destructuring.ts");
    expect(scopesIn("second")).toContain("variable.other.assignment.destructuring.ts");

    const objectLines = ["const {"];
    for (let index = 0; index < 6000; index++) {
      objectLines.push(`  item${index}${index < 5999 ? "," : ""}`);
    }
    objectLines.push("} = source;");
    editor.setText(objectLines.join("\r\n"));
    await languageMode.atTransactionEnd();

    let captures = rawCaptures(3000, 3006);
    expect(captures.length).toBeLessThanOrEqual(32);
    expect(
      captures.every(
        (capture) =>
          capture.node.startPosition.row >= 3000 && capture.node.startPosition.row < 3006,
      ),
    ).toBe(true);

    const arrayLines = ["const ["];
    for (let index = 0; index < 6000; index++) {
      arrayLines.push(`  item${index}${index < 5999 ? "," : ""}`);
    }
    arrayLines.push("] = source;");
    editor.setText(arrayLines.join("\r\n"));
    await languageMode.atTransactionEnd();

    captures = rawCaptures(3000, 3006);
    expect(captures.length).toBeLessThanOrEqual(24);
    expect(
      captures.every(
        (capture) =>
          capture.node.startPosition.row >= 3000 && capture.node.startPosition.row < 3006,
      ),
    ).toBe(true);

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).toContain("(#is? test.childOfType object_pattern)");
    expect(query).toContain('(#is? test.typeAt "parent.parent object_pattern")');
    expect(query).toContain("(#is? test.childOfType array_pattern)");
    expect(query).not.toMatch(/^\((?:object_pattern|array_pattern)\s+\(/m);
    expect(query).not.toContain("pattern: (object_pattern");
    expect(query).not.toMatch(
      /\(for_in_statement[\s\S]{0,160}left: \((?:object_pattern|array_pattern)/,
    );
  });

  it("keeps tile captures local inside a large type-argument parent", async () => {
    const lines = ["type Result = Factory<"];
    for (let index = 0; index < 6000; index++) lines.push(`  Type${index},`);
    lines.push(">;");
    await setUp(lines.join("\r\n"));

    const captures = rawCaptures(3000, 3006);
    expect(captures.length).toBeLessThanOrEqual(16);
    expect(
      captures.every(
        (capture) =>
          capture.node.startPosition.row >= 3000 && capture.node.startPosition.row < 3006,
      ),
    ).toBe(true);
  });

  it("keeps template escapes local inside a 6000-line template string", async () => {
    const lines = ["const value = `", ...Array.from({ length: 6000 }, () => "  \\n"), "`;"];
    await setUp(lines.join("\r\n"));
    expect(languageMode.tree.rootNode.hasError).toBe(false);
    expect(editor.scopeDescriptorForBufferPosition([1, 2]).getScopesArray()).toContain(
      "constant.character.escape.ts",
    );

    const startRow = 2998;
    const endRow = startRow + 6;
    const captures = rawCaptures(startRow, endRow);
    expect(captures.length).toBeLessThanOrEqual(24);
    expect(
      captures
        .filter(({ name }) => name === "constant.character.escape.ts")
        .every(({ node }) => node.startPosition.row >= startRow && node.startPosition.row < endRow),
    ).toBe(true);

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).not.toMatch(/\(template_string\s+\(escape_sequence\)/);
    expect(query).not.toMatch(/\(template_string\s+"`"/);
    expect(query).toContain('(#is? test.childOfType "string template_string")');
  });

  it("keeps ordinary string escapes local within one soft-wrapped row", async () => {
    const escapeCount = 20000;
    const prefix = 'const value = "';
    await setUp(`${prefix}${"\\n".repeat(escapeCount)}";`);
    expect(languageMode.tree.rootNode.hasError).toBe(false);

    const startColumn = prefix.length + escapeCount;
    expect(editor.scopeDescriptorForBufferPosition([0, startColumn]).getScopesArray()).toContain(
      "constant.character.escape.ts",
    );
    const layer = languageMode.rootLanguageLayer;
    const captures = layer.queries.highlightsQuery.captures(layer.tree.rootNode, {
      startPosition: new Point(0, startColumn),
      endPosition: new Point(0, startColumn + 12),
    });
    const escapes = captures.filter(({ name }) => name === "constant.character.escape.ts");
    expect(escapes.length).toBe(6);
    expect(
      escapes.every(
        ({ node }) =>
          node.startPosition.column >= startColumn && node.startPosition.column < startColumn + 12,
      ),
    ).toBe(true);

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).not.toMatch(/\(string\s+\(escape_sequence\)/);
    expect(query).not.toMatch(/\(string\s+["']/);
    expect(query).toContain('(#is? test.textAt "firstChild \\"")');
    expect(query).toContain('(#is? test.childOfType "string template_string")');
  });

  it("keeps template literal type interpolations local", async () => {
    const lines = [
      "type Value = `",
      ...Array.from({ length: 6000 }, (_, index) => `  \${Type${index}}`),
      "`;",
    ];
    await setUp(lines.join("\r\n"));
    expect(languageMode.tree.rootNode.hasError).toBe(false);

    const startRow = 2998;
    const endRow = startRow + 6;
    const captures = rawCaptures(startRow, endRow);
    expect(captures.length).toBeLessThanOrEqual(72);
    expect(
      captures
        .filter(
          ({ name }) =>
            name.startsWith("punctuation.section.embedded.") || name.startsWith("meta.embedded."),
        )
        .every(({ node }) => node.startPosition.row >= startRow && node.startPosition.row < endRow),
    ).toBe(true);

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).not.toMatch(/\(template_literal_type\s+"`"/);
    expect(query).not.toMatch(/\(template_literal_type\s+\(template_type/);
    expect(query).toContain("((template_type) @meta.embedded.line.interpolation._LANG_");
  });
});
