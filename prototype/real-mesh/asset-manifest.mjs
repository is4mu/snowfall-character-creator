export const MAKEHUMAN_ASSET_MANIFEST = Object.freeze({
  adapterContract: "scc-makehuman-adapter-v0",
  upstreamRepository: "makehumancommunity/makehuman",
  upstreamCommit: "a8bc2d54ff0ac92e78ff71431b1023eda42bf482",
  baseMeshPath: "makehuman/data/3dobjs/base.obj",
  baseMeshBlobSha: "d26635e9326e3cca30778fd7b9c00062b03cce09",
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
    calibrationStatus: "uncalibrated",
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
