import { NodePath } from "@babel/traverse";
import * as t from "@babel/types";

export const createProgramSubset = (ast: t.File, path: NodePath<t.Expression>) => {
  const collectedNodes = new WeakSet<t.Node>();
  const importDeclarations = new Set<t.ImportDeclaration>();

  function collectDependencies(nodePath: NodePath) {
    let nodeToAdd = nodePath.node;

    if (t.isVariableDeclarator(nodeToAdd) && t.isVariableDeclaration(nodePath.parent)) {
      nodeToAdd = nodePath.parent;
    }

    if (collectedNodes.has(nodeToAdd)) return;
    collectedNodes.add(nodeToAdd);

    nodePath.traverse({
      Identifier(innerPath) {
        const binding = innerPath.scope.getBinding(innerPath.node.name);
        if (binding && binding.path) {
          const bindingNode = binding.path.node;
          let nodeToCollect = bindingNode;

          if (t.isVariableDeclarator(bindingNode) && t.isVariableDeclaration(binding.path.parent)) {
            nodeToCollect = binding.path.parent;
          }

          if (!collectedNodes.has(nodeToCollect)) {
            if (t.isImportSpecifier(bindingNode) || t.isImportDefaultSpecifier(bindingNode)) {
              const importDecl = binding.path.parent as t.ImportDeclaration;
              importDeclarations.add(importDecl);
            } else {
              collectDependencies(binding.path);
            }
          }
        }
      },
    });
  }

  collectDependencies(path);

  const subset: t.Statement[] = [];

  for (const importDecl of importDeclarations) {
    subset.push(importDecl);
  }

  for (const node of ast.program.body) {
    if (collectedNodes.has(node)) {
      subset.push(node as t.Statement);
    }
  }

  const exportDefault = t.exportDefaultDeclaration(path.node);
  subset.push(exportDefault);

  return t.file(t.program(subset));
};
