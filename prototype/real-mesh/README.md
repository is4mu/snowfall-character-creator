# Real Human Mesh Prototype

Stage 1 of the SCC real-mesh adapter.

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
