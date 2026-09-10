const fs = require("fs");
const path = require("path");
const { Point } = require("lumine");

const HIGHLIGHTS_PATH = path.join(__dirname, "..", "grammars", "tsx-highlights.scm");

describe("TSX Tree-sitter highlights", () => {
  let editor;

  beforeEach(async () => {
    await lumine.packages.activatePackage("language-typescript");
  });

  afterEach(() => editor?.destroy());

  async function setUp(text) {
    editor = await lumine.workspace.open("component.tsx");
    editor.setText(text);
    await editor.getBuffer().languageMode.ready;
  }

  function rawCaptures(startRow, endRow) {
    const layer = editor.getBuffer().languageMode.rootLanguageLayer;
    return layer.queries.highlightsQuery.captures(layer.tree.rootNode, {
      startPosition: new Point(startRow, 0),
      endPosition: new Point(endRow, 0),
    });
  }

  function expectLocalAttributeTile(captures) {
    const localCaptures = captures.filter((capture) => capture.node.startPosition.row >= 3000);
    expect(captures.length).toBeLessThanOrEqual(60);
    expect(localCaptures.length).toBeGreaterThan(0);
    expect(localCaptures.every((capture) => capture.node.startPosition.row < 3006)).toBe(true);
  }

  it("preserves member tag names and tag delimiters", async () => {
    await setUp("const node = <Namespace.Widget prop={value} />;");

    const scopesAt = (text) => {
      const column = editor.lineTextForBufferRow(0).indexOf(text);
      return editor.scopeDescriptorForBufferPosition([0, column]).getScopesArray();
    };
    expect(scopesAt("Namespace.Widget")).toContain("entity.name.tag.ts.tsx");
    expect(scopesAt("Namespace.Widget")).not.toContain("support.other.object.ts.tsx");
    expect(scopesAt("<")).toContain("punctuation.definition.tag.begin.ts.tsx");
    expect(scopesAt("/>")).toContain("punctuation.definition.tag.end.ts.tsx");
  });

  it("keeps large opening and self-closing tags leaf-rooted", async () => {
    const opening = ["const node = (<Namespace.Widget"];
    for (let index = 0; index < 6000; index++) {
      opening.push(`  property${index}="value"`);
    }
    opening.push(">content</Namespace.Widget>);");
    await setUp(opening.join("\r\n"));
    expectLocalAttributeTile(rawCaptures(3000, 3006));

    const selfClosing = ["const node = (<Namespace.Widget"];
    for (let index = 0; index < 6000; index++) {
      selfClosing.push(`  property${index}="value"`);
    }
    selfClosing.push("/>);");
    editor.setText(selfClosing.join("\r\n"));
    await editor.getBuffer().languageMode.atTransactionEnd();
    expectLocalAttributeTile(rawCaptures(3000, 3006));

    const query = fs.readFileSync(HIGHLIGHTS_PATH, "utf8");
    expect(query).toContain("(#is? test.childOfType jsx_opening_element)");
    expect(query).toContain("(#is? test.childOfType jsx_self_closing_element)");
    expect(query).not.toMatch(/\(jsx_(?:opening|self_closing)_element\s+"[</]"/);
  });
});
