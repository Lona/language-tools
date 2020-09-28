# Lona Language Tools

A system for lexing, parsing, printing, serialization, and type generation.

This library can be used standalone, although it's intended for use with the Lona compiler, in order to support cross platform AST type generation.

> This is very experimental and unpolished. Speed isn't a goal yet, and the parser won't stop you from writing your grammar in a ridiculously slow way.

## Overview

This all-in-one library simplifies parsing and code generation.

The main challenge with existing tools is that they only handle one aspect of the pipeline, e.g. defining the language grammar. This means that everything after that, e.g. specifying the data structure of the parsed AST, will be arbitrary/left to the user. The problem then is that additional features, like pretty printing, must be written custom due to the arbitrary data format, and then kept in sync with the grammar.

This library includes several tools that share common data structures internally and are preconfigured to work well together:

- **Lexer** - A stateful, regex-based lexer. This is roughly a subset of the [VSCode monarch lexer](https://microsoft.github.io/monaco-editor/monarch.html).

- **Parser** - A [top-down parser](https://en.wikipedia.org/wiki/Top-down_parsing), supporting left recursion thanks to the algorithm by [Frost et al.](https://www.researchgate.net/publication/30053225_Modular_and_efficient_top-down_parsing_for_ambiguous_left-recursive_grammars). The parser outputs an internal parse tree format.

- **Shaper** - This takes an internal parse tree as input and generates a simpler, human-friendly AST format. It can also do the reverse: take an AST and generate the internal parse tree.

- **Printer** - This takes an internal parse tree and pretty prints.

- **Templates** - For convenience, we expose tagged template functions for usage when generating code.

As an additional goal, all lexer/grammar/ast definitions should be JSON serializable to make it possible to implement this project in other languages in the future.

## Installation

```bash
npm install --save language-tools
```

OR

```bash
yarn add language-tools
```

## Usage

See the [languages](/src/languages) directory for examples.

Languages are defined as a collection of "patterns", where each pattern is an instruction for how to parse or print tokens. Some instructions only affect parsing and some only affect printing - but most are shared, so that parsing and printing are kept in sync. Some commands also include options to specify the structure of AST data types.

When written programmatically, languages should be defined using the exported builder functions, rather than as JSON. The JSON is somewhat verbose, while the builders support concise shorthands and apply relevant defaults. In the future, languages will hopefully be written using Lona's "Logic" DSL rather than programmatically.
