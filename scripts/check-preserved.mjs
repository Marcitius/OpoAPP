import fs from "node:fs";
import crypto from "node:crypto";
import ts from "typescript";
import assert from "node:assert/strict";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const files = JSON.parse(
  fs.readFileSync("docs/v10-protected-files.json", "utf8"),
);
for (const [file, expected] of Object.entries(files))
  assert.equal(
    hash(fs.readFileSync(file)),
    expected,
    `${file} ha cambiado respecto a v10`,
  );
// Structural fingerprints ignore formatting, comments and redundant parentheses.
function shape(node) {
  if (ts.isParenthesizedExpression(node)) return shape(node.expression);
  const children = [];
  ts.forEachChild(node, (child) => {
    children.push(shape(child));
  });
  return {
    kind: ts.SyntaxKind[node.kind],
    ...(ts.isIdentifier(node) || ts.isLiteralExpression(node)
      ? { text: node.text }
      : {}),
    children,
  };
}
export function functions(file) {
  const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    ),
    found = {};
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) {
      found[node.name.text] = hash(
        JSON.stringify({
          parameters: node.parameters.map(shape),
          body: shape(node.body),
        }),
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}
const behavior = JSON.parse(
  fs.readFileSync("docs/v10-behavior-fingerprints.json", "utf8"),
);
let count = 0;
for (const [file, expected] of Object.entries(behavior)) {
  const actual = functions(file);
  for (const [name, fingerprint] of Object.entries(expected)) {
    assert.equal(
      actual[name],
      fingerprint,
      `${file}: ${name} ha cambiado respecto a v10`,
    );
    count++;
  }
}
console.log(
  `Integridad v10: ${Object.keys(files).length} archivos y ${count} funciones de negocio conservados.`,
);
