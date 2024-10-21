/** wrong types */
import _generate from "@babel/generator";
import _traverse from "@babel/traverse";
export const traverse = (_traverse as any).default as typeof _traverse;
export const generate = (_generate as any).default as typeof _generate;
