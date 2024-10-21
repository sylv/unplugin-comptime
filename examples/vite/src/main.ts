import { comptime } from "unplugin-comptime";
import { todos } from "./data.comptime";
import prettyMs from "pretty-ms";

const outerValue = "test";
const result = comptime(async () => {
  const result = await fetch("https://api.github.com/repos/sylv/unplugin-comptime");
  const json = await result.json();
  const { stargazers_count, forks_count, pushed_at } = json;
  const pushedAgo = prettyMs(Date.now() - new Date(pushed_at).getTime());
  return {
    pushedAgo,
    outerValue,
    data: { stargazers_count, forks_count },
  };
});

console.log(`Pushed ${result.pushedAgo} ago`);
console.log(`Stars: ${result.data.stargazers_count}`);
console.log(`Forks: ${result.data.forks_count}`);
console.log(`Todos: ${todos}`);
