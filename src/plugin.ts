import { parse } from "@babel/parser";
import t from "@babel/types";
import { createFilter } from "@rollup/pluginutils";
import { deadCodeElimination } from "babel-dead-code-elimination";
import { uneval } from "devalue";
import { unlink, writeFile } from "fs/promises";
import { join } from "path";
import { createUnplugin } from "unplugin";
import { createServer, type FilterPattern, type ViteDevServer } from "vite";
import { ViteNodeRunner } from "vite-node/client";
import { ViteNodeServer } from "vite-node/server";
import { installSourcemapsSupport } from "vite-node/source-map";
import { generate } from "./babel";
import { collectComptimeCalls } from "./helpers/collectComptimeCalls";
import { createProgramSubset } from "./helpers/createProgramSubset";

export interface Options {
  include?: FilterPattern;
  exclude?: FilterPattern;
}

// this works around evaluateFile() running the plugin on the file again
// and causing an infinite loop.
const ignoreIds = new Set<string>();

const resolveOptions = (options?: Options) => {
  return {
    include: options?.include || [/\.[cm]?[jt]sx?$/],
    exclude: options?.exclude || [/node_modules/],
  } satisfies Options;
};

const plugin = createUnplugin<Options | undefined>((rawOptions) => {
  const options = resolveOptions(rawOptions);
  const filter = createFilter(options.include, options.exclude);

  let isExternalServer = true;
  let server: ViteDevServer | undefined;
  let node: ViteNodeServer | undefined;
  let runner: Promise<ViteNodeRunner> | undefined;

  const createRunner = async () => {
    if (!server) {
      isExternalServer = false;
      server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] } });
    }

    if (!node || node.server !== server) {
      node = new ViteNodeServer(server);
      // fixes stacktraces in Errors
      installSourcemapsSupport({
        getSourceMap: (source) => node!.getSourceMap(source),
      });
    }

    return new ViteNodeRunner({
      root: server.config.root,
      base: server.config.base,
      fetchModule(id) {
        return node!.fetchModule(id);
      },
      resolveId(id, importer) {
        return node!.resolveId(id, importer);
      },
    });
  };

  const getRunner = () => {
    if (!runner) runner = createRunner();
    return runner;
  };

  return {
    name: "unplugin-comptime",
    transformInclude(id) {
      return filter(id);
    },
    transform: async (source, id) => {
      if (ignoreIds.has(id)) return null;
      if (id.includes(".comptime.")) {
        // the entire file is a comptime file, so we evaluate the entire thing and replace the exports.
        const runner = await getRunner();

        ignoreIds.add(id);
        const module = await runner.executeId(id).finally(() => {
          ignoreIds.delete(id);
        });

        const newFile = t.file(t.program([]));
        for (const [exportName, exportValue] of Object.entries(module)) {
          if (typeof exportValue === "function") {
            throw new Error(`File ${id} exports a function, which is not supported in comptime files`);
          }

          newFile.program.body.push(
            t.exportNamedDeclaration(
              t.variableDeclaration("const", [
                t.variableDeclarator(t.identifier(exportName), t.valueToNode(exportValue)),
              ]),
            ),
          );
        }

        return generate(newFile).code;
      }

      if (!source.includes("comptime")) return null;
      const ast = parse(source, { sourceType: "module" });
      const comptimeCalls = collectComptimeCalls(ast);

      for (const comptimeCall of comptimeCalls) {
        const runner = await getRunner();

        // create a new program with only the comptime call as a default export and any dependencies
        // (imports, certain declarations, etc)
        const runnableAst = createProgramSubset(ast, comptimeCall.fn);

        // because we run the code in /tmp and not the original file, we have to rewrite the imports
        // to point to the original file.
        for (const node of runnableAst.program.body) {
          if (t.isImportDeclaration(node)) {
            const [, fsPath] = await runner.resolveUrl(node.source.value, id);
            if (fsPath) {
              node.source.value = fsPath;
            }
          }
        }

        // todo: using /tmp is not ideal, it means transforms that should be run on the code
        // might not be (because if plugins are configured but only include src/ or something)
        // we could either write to a temporary file at the same path as the original file (gross, if we exit before cleanup we leave files)
        // or maybe use node_modules/.cache/unplugin-comptime or something (avoids cleanup issues but would still probably accidentally bypass some transforms)
        // it would be better if we could eval the code directly, without writing to a file, and just tell vite-node where the code is.
        const tempPath = join("/tmp", comptimeCall.id + ".ts");
        const runnableSource = generate(runnableAst).code;
        await writeFile(tempPath, runnableSource);

        try {
          // todo: ideally we could evalute this, but it doesn't seem like vite-node
          // supports that. which is very sad.
          const exports = await runner.executeFile(tempPath);
          const result = await exports.default();
          const devalued = uneval(result);
          comptimeCall.path.replaceWithSourceString(devalued);
        } catch (error) {
          console.error(error);
        } finally {
          await unlink(tempPath);
        }
      }

      if (comptimeCalls[0]) {
        // todo: ideally we should take the extracted dependencies from createProgramSubset()
        // and then only remove the dependencies we saw. that would make sure we dont accidentally remove
        // something we arent supposed to.
        deadCodeElimination(ast);
        return generate(ast);
      }
    },
    buildEnd: async () => {
      if (server && !isExternalServer) {
        await server!.close();
      }
    },
    vite: {
      configureServer(_server) {
        isExternalServer = true;
        server = _server;
      },
    },
  };
});

export default plugin;
