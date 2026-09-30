# Real Human Mesh Prototype

Stage 1 loads the pinned real human base mesh. Stage 2 preserves source vertex indices and adds independent CC0 target parsing/application.

## Run

Serve the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/prototype/real-mesh/
```

The browser loads a MakeHuman CC0 base OBJ pinned to a specific upstream commit.

Network access is required for the Stage 1 preview.

## Test

```bash
node --test prototype/real-mesh/test/*.test.mjs
```

Tests do not download the mesh.

## Boundary

- SCC code: Apache-2.0
- pinned MakeHuman graphical asset: CC0-1.0
- MakeHuman application code: AGPL and not copied into this repository

See [../../docs/real-mesh-adapter.md](../../docs/real-mesh-adapter.md).


## Geometry engine

- `makehuman-geometry.mjs` — minimal index-preserving OBJ parser plus MakeHuman target parser/application engine.
- `test/makehuman-geometry.test.mjs` — synthetic parser and target-delta contract tests.

The browser preview builds BufferGeometry from the SCC parser rather than Three.js OBJLoader so upstream target indices remain stable.


## Shoulder target debug

The prototype fetches the pinned MakeHuman shoulder-distance decrease/increase targets and exposes a renderer-only signed debug weight from `-1..1`.

The value is **uncalibrated** and is not saved to SCC character data.

Every change is reapplied from immutable base positions, then the mesh is refit to canonical SCC height.
