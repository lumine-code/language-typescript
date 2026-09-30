let injectionRegistrations = [];

exports.activate = function () {
  for (const scopeName of ["source.ts", "source.tsx"]) {
    injectionRegistrations.push(
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
      }),
    );

    injectionRegistrations.push(
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
      }),
    );

    injectionRegistrations.push(
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
      }),
    );

    injectionRegistrations.push(
      lumine.grammars.addInjectionPoint(scopeName, {
        type: "regex_pattern",
        combined: true,
        language() {
          return "regex";
        },
        content(regex) {
          return regex;
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

exports.deactivate = function () {
  for (const registration of injectionRegistrations.splice(0)) registration.dispose();
};
