export const todos = await fetch("https://jsonplaceholder.typicode.com/todos/1").then((response) =>
  response.json(),
);
