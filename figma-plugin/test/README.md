# Plugin tests

Runs `code.js` against a mock of the Figma Plugin API, so failures are caught
here instead of in Figma.

```bash
node test/harness.mjs   # load, count, dump selection, dump whole file + SVG
node test/compat.mjs    # older Figma without loadAllPagesAsync, missing
                        # apiVersion/editorType, undefined selection
```

Both found real bugs during development:

- `Array.prototype.flatMap` in the whole-file path — older Figma engines throw
  `flatMap is not a function`, which is the error a user hit.
- The SVG exporter filtered on a `vector` flag that only exists on the
  *serialized* objects, not on the real nodes, so it silently exported 0 SVGs.
