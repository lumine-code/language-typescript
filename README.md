# language-typescript

TypeScript language support.

## Features

- **Grammars**: provides Tree-sitter grammars built from [tree-sitter-regex](https://github.com/tree-sitter/tree-sitter-regex) and [tree-sitter-typescript](https://github.com/tree-sitter/tree-sitter-typescript) and TextMate grammars derived from [atom/language-typescript](https://github.com/atom/language-typescript).
- **Syntax highlighting**: full grammar coverage for TypeScript, TSX, and embedded regular expressions.
- **Snippets**: shortcuts for common TypeScript constructs.
- **Indentation**: configurable indent rules for braces, brackets, parentheses, switch cases, and hanging operators.

## Installation

To install `language-typescript` search for _language-typescript_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/language-typescript`.

## Services

- **hyperlink.injection** (`^1.0.0`): consumed to highlight URLs inside TypeScript files as clickable links.
- **todo.injection** (`^1.0.0`): consumed to highlight `TODO`-style markers inside comments.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
