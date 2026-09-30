export const MAKEHUMAN_ASSET_MANIFEST = Object.freeze({
  adapterContract: "scc-makehuman-adapter-v0",
  upstreamRepository: "makehumancommunity/makehuman",
  upstreamCommit: "a8bc2d54ff0ac92e78ff71431b1023eda42bf482",
  baseMeshPath: "makehuman/data/3dobjs/base.obj",
  baseMeshBlobSha: "d26635e9326e3cca30778fd7b9c00062b03cce09",
  anthropometryGroup: "body",
  expectedBodyVertexCount: 13380,
  expectedBodyTriangleCount: 26756,
  baseMeshUrl:
    "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/3dobjs/base.obj",
  assetLicense: "CC0-1.0",
  upstreamCodeLicense: "AGPL-3.0-or-later",
  reusePolicy:
    "SCC may reuse pinned MakeHuman graphical assets, but must not copy MakeHuman application source code into this Apache-2.0 repository.",
});

export const MAKEHUMAN_MEASUREMENT_TARGETS = Object.freeze({
  shoulderBreadthCm: Object.freeze({
    modifier: "measure/measure-shoulder-dist-decr|incr",
    calibrationStatus: "experimental-calibration",
    decrease: Object.freeze({
      path: "makehuman/data/targets/measure/measure-shoulder-dist-decr.target",
      blobSha: "eb25c3214db91206340ba5e28fcd7f29fadae4a9",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/measure/measure-shoulder-dist-decr.target",
    }),
    increase: Object.freeze({
      path: "makehuman/data/targets/measure/measure-shoulder-dist-incr.target",
      blobSha: "0d6ba8d828c7d9ee42ef18a814d413712214ac21",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/measure/measure-shoulder-dist-incr.target",
    }),
  }),
});

export const MAKEHUMAN_SHAPE_PRIOR_TARGETS = Object.freeze({
  contract: "scc-makehuman-shape-prior-assets-v0",
  sourceNeutralization:
    "Each endpoint is an equal blend of three pinned upstream young-adult macro source groups. Individual source-group identity is not part of SCC character or renderer state.",
  feminine: Object.freeze([
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/african-female-young.target",
      blobSha: "a7d2b130667cc81ecd1ca0598da9be27bec1864a",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/african-female-young.target",
    }),
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/asian-female-young.target",
      blobSha: "f862c96add11c31ab1ca75c69e1c67ae5e0e3d5f",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/asian-female-young.target",
    }),
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/caucasian-female-young.target",
      blobSha: "9d1f0cbeedc9a6a51abe33f1ebb5fa7c5a7edbf1",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/caucasian-female-young.target",
    }),
  ]),
  masculine: Object.freeze([
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/african-male-young.target",
      blobSha: "dd5743e48700267d76596f575bf17b4b5cc3b3e0",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/african-male-young.target",
    }),
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/asian-male-young.target",
      blobSha: "8cd3ef3e9ddb06ee2d166f75f9ac10871251f938",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/asian-male-young.target",
    }),
    Object.freeze({
      path: "makehuman/data/targets/macrodetails/caucasian-male-young.target",
      blobSha: "c3b82f92c5ced85599199cd184b0faf3b3fc6881",
      url:
        "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data/targets/macrodetails/caucasian-male-young.target",
    }),
  ]),
});
