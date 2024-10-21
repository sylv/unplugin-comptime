# unplugin-comptime

Run code at compile-time and inline the result. Aimed at reducing bundle sizes and improving performance by doing annoying setup at compile time.
Heavily inspired by [unplugin-macros](https://github.com/unplugin/unplugin-macros) which has related functionality.

```ts
import { comptime } from 'unplugin-comptime'
import chalk from 'chalk' // included in the final bundle
import prettyMs from 'pretty-ms' // removed from the final bundle

// async is supported
const data = comptime(async () => {
    const response = await fetch('https://example.com/api/announcements')
    const json = await response.json()
    const lastAnnouncementTime = new Date(json[0].time)
    const timeSinceLastAnnouncement = Date.now() - lastAnnouncementTime.getTime()
    const formattedTime = prettyMs(timeSinceLastAnnouncement)

    return {
        formattedTime,
        announcements: json,
    }
})

// at compile time the http request will be made and "data" will be replaced with the result.
// "prettyMs" will be removed as we aren't using it outside of comptime().
console.log(chalk.green(`Last announcement was ${data.formattedTime} ago`))
```
Becomes
```ts
import chalk from 'chalk' // included in the final bundle

const data = {
    formattedTime: '2 days',
    announcements: [
        { time: '2022-01-01T00:00:00Z' }
    ],
}

console.log(chalk.green(`Last announcement was ${data.formattedTime} ago`))
```

## installation


```bash
pnpm add unplugin-comptime
```

<details>
<summary>Vite</summary><br>

```ts
// vite.config.ts
import comptime from 'unplugin-comptime/vite'

export default defineConfig({
  plugins: [comptime()],
})
```

<br></details>

<details>
<summary>Rollup</summary><br>

```ts
// rollup.config.js
import comptime from 'unplugin-comptime/rollup'

export default {
  plugins: [comptime()],
}
```

<br></details>

<details>
<summary>esbuild</summary><br>

Requires esbuild >= 0.15

```ts
// esbuild.config.js
import { build } from 'esbuild'

build({
  plugins: [require('unplugin-comptime/esbuild')()],
})
```

<br></details>

<details>
<summary>Webpack</summary><br>

```ts
// webpack.config.js
module.exports = {
  /* ... */
  plugins: [require('unplugin-comptime/webpack')()],
}
```

<br></details>

## usage

### `comptime()`

```ts
import { comptime } from 'unplugin-comptime'

// gets replaced with "3" at compile time
const x = comptime(() => 1 + 2)
```

```ts
import { someDependency } from 'some-dependency' // removed because its only used in comptime()

// async is supported. no need to await
const x = comptime(async () => {
    const result = await someDependency()
    // rich data structures are supported
    // devalue (https://github.com/Rich-Harris/devalue) is used, anything it supports is supported
    return new Map(result)
})
```

### `*.comptime.ts`

`*.comptime.ts` files are executed at compile time, and their exports are replaced with the raw value.

```ts
// foo.comptime.ts

const values = new Map()
// add some values, if you want
values.set('foo', 'bar')

export { values }
```

## todo

- Cache `comptime()` results to speed up subsequent builds
- Require `comptime()` be top-level (?)
- Add `macro()` 
  - Wraps a function and replaces all calls to it with the result. Unlike `comptime()`, this would support arguments.
  - Using a wrapper instead of import attributes avoids issues with people forgetting to add the import attribute and accidentally including the function in the final bundle.
  - A wrapper means you couldn't use third-party functions and couldn't use the inner function outside of the macro, which isn't ideal. This is probably fine though, `comptime()` covers both those use cases in a more elegant way.
- Batch `comptime()` calls from the same file into a single execution