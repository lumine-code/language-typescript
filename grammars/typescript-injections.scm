((call_expression
  function: (identifier) @_tag
  arguments: (template_string (string_fragment) @injection.content)) @injection.owner
  (#match? @_tag "\\b[sS][tT][yY][lL][eE][dD]\\b")
  (#set! injection.language "css"))

((call_expression
  function: (identifier) @injection.language
  arguments: (template_string (string_fragment) @injection.content)) @injection.owner
  (#not-match? @injection.language "\\b[sS][tT][yY][lL][eE][dD]\\b"))

((call_expression
  function: (member_expression) @_tag
  arguments: (template_string (string_fragment) @injection.content)) @injection.owner
  (#not-match? @_tag "\n")
  (#match? @_tag "\\b[sS][tT][yY][lL][eE][dD]\\b")
  (#set! injection.language "css"))

((call_expression
  function: (member_expression) @injection.language
  arguments: (template_string (string_fragment) @injection.content)) @injection.owner
  (#not-match? @injection.language "\n")
  (#not-match? @injection.language "\\b[sS][tT][yY][lL][eE][dD]\\b"))

((assignment_expression
  left: (member_expression property: (_) @_property)
  right: (template_string (string_fragment) @injection.content)) @injection.owner
  (#eq? @_property "innerHTML")
  (#set! injection.language "html"))

((comment) @injection.owner @injection.content
  (#match? @injection.content "^/\\*\\*")
  (#set! injection.language "jsdoc")
  (#set! injection.language-scope "none"))

; Annotation candidates are filtered by the target grammar.
([
  (template_string)
  (string_fragment)
] @injection.owner @injection.content
  (#set! injection.language "hyperlink")
  (#set! injection.language-scope "none"))

((comment) @injection.owner @injection.content
  (#not-match? @injection.owner "^/\\*\\*")
  (#set! injection.language "hyperlink")
  (#set! injection.language-scope "none")
  (#set! injection.include-children))

((comment) @injection.owner @injection.content
  (#not-match? @injection.owner "^/\\*\\*")
  (#set! injection.language "todo")
  (#set! injection.language-scope "none")
  (#set! injection.include-children))