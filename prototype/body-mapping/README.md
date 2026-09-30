# 3D Body Mapping Prototype

Experimental browser preview for the `scc-body-v1` mapping boundary.

## Run

From the repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/prototype/body-mapping/
```

The preview imports Three.js 0.186.1 from jsDelivr. No Three.js code or character asset is vendored into this repository.

## Test

```bash
node --test prototype/body-mapping/test/*.test.mjs
```

The adapter tests have no third-party runtime dependency.

## Files

- `adapter.mjs` — SCC body data to disposable renderer parameters.
- `renderer.mjs` — procedural gray-body renderer.
- `app.mjs` — interactive preview wiring.
- `index.html` — browser entry point.
- `test/adapter.test.mjs` — adapter-boundary tests.

See [../../docs/3d-body-mapping-prototype.md](../../docs/3d-body-mapping-prototype.md) for the architectural findings.
