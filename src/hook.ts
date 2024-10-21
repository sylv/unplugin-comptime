export const comptime = <T>(fn: () => T): Awaited<T> => {
  throw new Error(
    `comptime() is not supported at runtime. Have you configured the bundler plugin correctly?`,
  );
};
