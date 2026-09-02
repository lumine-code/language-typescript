exports.activate = function () {
  for (const scopeName of ["source.ts", "source.tsx"]) {
    lumine.grammars.addInjectionPoint(scopeName, {
      type: "comment",
      language(comment) {
        if (comment.text.startsWith("/**")) return "jsdoc";
      },
      content(comment) {
        return comment;
      },
      languageScope: null,
      // coverShallowerScopes: true
    });

    lumine.grammars.addInjectionPoint(scopeName, {
      type: "call_expression",

      language(callExpression) {
        const { firstChild } = callExpression;
        switch (firstChild.type) {
          case "identifier":
            return languageStringForTemplateTag(firstChild.text);
          case "member_expression":
            if (firstChild.startPosition.row === firstChild.endPosition.row) {
              return languageStringForTemplateTag(firstChild.text);
            }
        }
      },

      content(callExpression) {
        const { lastChild } = callExpression;
        if (lastChild.type === "template_string") {
          return stringFragmentsOfTemplateString(lastChild);
        }
      },
    });

    lumine.grammars.addInjectionPoint(scopeName, {
      type: "assignment_expression",

      language(callExpression) {
        const { firstChild } = callExpression;
        if (firstChild.type === "member_expression") {
          if (firstChild.lastChild.text === "innerHTML") {
            return "html";
          }
        }
      },

      content(callExpression) {
        const { lastChild } = callExpression;
        if (lastChild.type === "template_string") {
          return stringFragmentsOfTemplateString(lastChild);
        }
      },
    });

    lumine.grammars.addInjectionPoint(scopeName, {
      type: "regex_pattern",
      language() {
        return "regex";
      },
      content(regex) {
        return regex;
      },
      languageScope: null,
    });
  }
};

exports.consumeHyperlinkInjection = (hyperlink) => {
  for (const scopeName of ["source.ts", "source.tsx"]) {
    hyperlink.addInjectionPoint(scopeName, {
      types: ["template_string", "string_fragment", "comment"],
      language(node) {
        if (node.type === "comment" && node.text.startsWith("/**")) return null;
      },
    });
  }
};

exports.consumeTodoInjection = (todo) => {
  for (const scopeName of ["source.ts", "source.tsx"]) {
    todo.addInjectionPoint(scopeName, {
      types: ["comment"],
      language(node) {
        if (node.text.startsWith("/**")) return null;
      },
    });
  }
};

const STYLED_REGEX = /\bstyled\b/i;

function languageStringForTemplateTag(tag) {
  const normalized = tag.trim().toLowerCase();
  if (STYLED_REGEX.test(normalized)) {
    return "css";
  } else {
    return normalized;
  }
}

function stringFragmentsOfTemplateString(templateStringNode) {
  return templateStringNode.children.filter((c) => c.type === "string_fragment");
}
