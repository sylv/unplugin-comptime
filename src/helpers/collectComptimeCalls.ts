import { type ParseResult } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import t from "@babel/types";
import { randomBytes } from "crypto";
import { traverse } from "../babel";

interface ComptimeCall {
  id: string;
  fn: NodePath<t.Expression>;
  path: NodePath<t.CallExpression>;
}

export const collectComptimeCalls = (ast: ParseResult<t.File>) => {
  const comptimeCalls: ComptimeCall[] = [];

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === "unplugin-comptime") {
        path.remove();
      }
    },
    CallExpression(path) {
      if (path.node.callee.type !== "Identifier") return;
      if (path.node.callee.name !== "comptime") return;

      const value = path.node.arguments[0]!;
      if (!t.isExpression(value)) {
        throw new Error("comptime argument must be an expression");
      }

      // collect all identifiers used in the comptime function that are not defined in the comptime function
      const identifiers = new Set<NodePath<t.Identifier>>();
      traverse(
        value,
        {
          Identifier(path) {
            // ignore the identifier if it is defined in the comptime function
            if (path.scope.getBinding(path.node.name)?.scope === path.scope) return;
            identifiers.add(path);
          },
        },
        path.scope,
        path,
      );

      comptimeCalls.push({
        id: `comptime${randomBytes(8).toString("hex")}`,
        fn: path.get("arguments.0") as NodePath<t.Expression>,
        path: path,
      });

      // we can skip it, we'll be replacing it anyway.
      path.skip();
    },
  });
  return comptimeCalls;
};
