let injectionRegistrations = [];

// Regex recovery needs a semantic guard before sharing a parser.
exports.activate = function () {
  for (const scopeName of ["source.ts", "source.tsx"]) {
    injectionRegistrations.push(
      lumine.grammars.addInjectionPoint(scopeName, {
        type: "regex",
        combined: canCombineRegex,
        combinedMaxMembers: 128,
        language() {
          return "regex";
        },
        content(regex) {
          return regex.childForFieldName("pattern");
        },
        languageScope: null,
      }),
    );
  }
};

exports.consumeHyperlinkInjection = (hyperlink) => {
  const registrations = [];
  for (const scopeName of ["source.ts", "source.tsx"]) {
    registrations.push(
      hyperlink.addInjectionPoint(scopeName, {
        types: ["template_string", "string_fragment", "comment"],
        language(node) {
          if (node.type === "comment" && node.text.startsWith("/**")) return null;
        },
      }),
    );
  }
  return {
    dispose() {
      for (const registration of registrations.splice(0)) registration.dispose();
    },
  };
};

exports.consumeTodoInjection = (todo) => {
  const registrations = [];
  for (const scopeName of ["source.ts", "source.tsx"]) {
    registrations.push(
      todo.addInjectionPoint(scopeName, {
        types: ["comment"],
        language(node) {
          if (node.text.startsWith("/**")) return null;
        },
      }),
    );
  }
  return {
    dispose() {
      for (const registration of registrations.splice(0)) registration.dispose();
    },
  };
};

// Keep unfinished patterns isolated so error recovery cannot consume the
// following literal and apply its scopes to intervening TypeScript.
function canCombineRegex(node) {
  const pattern = node.childForFieldName("pattern");
  if (!pattern || pattern.endIndex - pattern.startIndex > 16384) return false;
  const flags = node.childForFieldName("flags");
  if (flags && flags.endIndex - flags.startIndex > 32) return false;
  const text = pattern.text;
  const flagText = flags?.text ?? "";
  // Unicode sets and non-ASCII group names need recovery in their own range
  // because the shared Tree-sitter regex grammar does not implement them.
  if (flagText.includes("v")) return false;
  for (const name of text.matchAll(/\(\?<([^=!][^>]*)>|\\k<([^>]+)>/g)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name[1] ?? name[2])) return false;
  }
  // Preserve literal boundaries when legacy or variable-length escapes would
  // otherwise consume characters from the next independent pattern.
  if (/\\[0-9]+$/.test(text)) return false;
  try {
    new RegExp(text, flagText);
    if (!/[uv]/.test(flagText)) new RegExp(text, `${flagText}u`);
    return true;
  } catch {
    return false;
  }
}

exports.deactivate = function () {
  for (const registration of injectionRegistrations.splice(0)) registration.dispose();
};
