module.exports = grammar({
  name: "yuck",
  extras: $ => [/\s/, $.line_comment],
  externals: $ => [
    $.unescaped_single_quote_string_fragment,
    $.unescaped_double_quote_string_fragment,
    $.unescaped_backtick_string_fragment,
  ],

  rules: {
    source_file: $ => repeat($._ast),
    _ast: $ =>
      choice($.list, $.array, $.keyword, $.symbol, $.literal, $.string, $.expr),
    line_comment: _ => token(seq(";", /.*/)),
    list: $ => seq("(", repeat($._ast), ")"),
    array: $ => seq("[", repeat($._ast), "]"),
    literal: $ => choice($.num_literal, $.bool_literal),
    num_literal: _ => /[+-]?(?:[0-9]+[.])?[0-9]+/,
    bool_literal: _ => choice("true", "false"),
    keyword: _ => /:[^\s\)\]}]+/,
    symbol: _ => /[a-zA-Z_!\?<>/\.\*-\+\-][^\s{}\(\)\[\](){}]*/,
    string: $ =>
      choice(
        string($, $.unescaped_single_quote_string_fragment, "'"),
        string($, $.unescaped_double_quote_string_fragment, '"'),
        string($, $.unescaped_backtick_string_fragment, "`")
      ),
    expr: $ => seq("{", $.simplexpr, "}"),

    // I think lookahead regexes are unfortunately not supported in tree-sitter, thus use an external scanner instead
    // unescaped_string_fragment: _ => repeat(/[^\"\\]+(?:(?=\${)||(?=\\))/),
    // I think right now every single character is allowed as escape sequence
    escape_sequence: _ => token.immediate(seq("\\", /./)),
    string_interpolation_start: _ => "${",
    string_interpolation_end: _ => "}",
    string_interpolation: $ =>
      seq(
        $.string_interpolation_start,
        $.simplexpr,
        $.string_interpolation_end
      ),

    // Simple expression parser
    // TODO prec necessary for atoms?
    simplexpr: $ =>
      choice(
        prec.left(10, $.bool_literal),
        prec.left(10, $.num_literal),
        prec.left(10, $.string),
        prec.left(10, $.ident),
        prec.left(10, seq("(", $.simplexpr, ")")),
        $.json_array,
        $.json_object,
        $.function_call,
        $.json_access,
        $.json_safe_access,
        $.json_dot_access,
        $.json_safe_dot_access,
        $.unary_expression,
        $.binary_expression
      ),
    ident: _ => /[a-zA-Z_][a-zA-Z0-9_-]*/,
    json_array: $ => prec.left(10, seq("[", commaSep($.simplexpr), "]")),
    json_object: $ =>
      prec.left(
        10,
        seq("{", commaSep(seq($.simplexpr, ":", $.simplexpr)), "}")
      ),
    function_call: $ =>
      prec.right(
        9,
        seq($.ident, field("operator", "("), commaSep($.simplexpr), ")")
      ),
    json_access: $ =>
      prec.right(
        9,
        seq($.ident, field("operator", "["), alias($.simplexpr, $.index), "]")
      ),
    json_safe_access: $ =>
      prec.right(
        9,
        seq(
          $.ident,
          field("operator", "?."),
          "[",
          alias($.simplexpr, $.index),
          "]"
        )
      ),
    json_dot_access: $ =>
      prec.right(
        9,
        seq($.ident, field("operator", "."), alias($.ident, $.index))
      ),
    json_safe_dot_access: $ =>
      prec.right(
        9,
        seq($.ident, field("operator", "?."), alias($.ident, $.index))
      ),
    unary_expression: $ =>
      choice(
        prec.right(8, seq("!", $.simplexpr)),
        prec.right(8, seq("-", $.simplexpr))
      ),
    binary_expression: $ =>
      choice(
        prec.left(7, seq($.simplexpr, field("operator", "*"), $.simplexpr)),
        prec.left(7, seq($.simplexpr, field("operator", "/"), $.simplexpr)),
        prec.left(7, seq($.simplexpr, field("operator", "%"), $.simplexpr)),
        prec.left(6, seq($.simplexpr, field("operator", "+"), $.simplexpr)),
        prec.left(6, seq($.simplexpr, field("operator", "-"), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", "=="), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", "!="), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", ">="), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", "<="), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", ">"), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", "<"), $.simplexpr)),
        prec.left(5, seq($.simplexpr, field("operator", "=~"), $.simplexpr)),
        prec.left(4, seq($.simplexpr, field("operator", "&&"), $.simplexpr)),
        prec.left(4, seq($.simplexpr, field("operator", "||"), $.simplexpr)),
        prec.left(4, seq($.simplexpr, field("operator", "?:"), $.simplexpr)),
        prec.left(
          3,
          seq(
            $.simplexpr,
            field("operator", "?"),
            $.simplexpr,
            field("operator", ":"),
            $.simplexpr
          )
        )
      ),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function string($, literalRule, quote) {
  return seq(
    quote,
    repeat(choice(literalRule, $.string_interpolation, $.escape_sequence)),
    quote
  );
}
