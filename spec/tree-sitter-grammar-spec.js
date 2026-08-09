const path = require("path");

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
});
