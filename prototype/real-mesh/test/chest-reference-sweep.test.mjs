import assert from "node:assert/strict";
import test from "node:test";

import {
  CHEST_REFERENCE_SWEEP_CONTRACT,
  detectChestReferenceJumps,
  detectUnderbustTransitions,
  evenlySpacedWeights,
  jumpNeighborhoodIndices,
  summarizeChestReferenceLandscape,
} from "../chest-reference-sweep.mjs";

test("weight sweep includes exact renderer endpoints", () => {
  const weights = evenlySpacedWeights(5);
  assert.deepEqual(weights, [-1, -0.5, 0, 0.5, 1]);
});

test("detects a chest reference jump larger than one normal sample step", () => {
  const samples = [
    {
      status: "measured",
      weight: -0.2,
      measuredChestCm: 89.9,
      selectedChestHeightFraction: 0.755,
    },
    {
      status: "measured",
      weight: -0.175,
      measuredChestCm: 90.4,
      selectedChestHeightFraction: 0.75,
    },
    {
      status: "measured",
      weight: -0.15,
      measuredChestCm: 91.0,
      selectedChestHeightFraction: 0.72,
    },
  ];

  const jumps = detectChestReferenceJumps(samples, {
    normalStepFraction: 0.005,
  });

  assert.equal(jumps.length, 1);
  assert.equal(jumps[0].leftMeasuredChestCm, 90.4);
  assert.equal(jumps[0].rightMeasuredChestCm, 91.0);
  assert.equal(jumps[0].deltaHeightFraction, -0.03);
});

test("one-step drift is not treated as discontinuous switching", () => {
  const jumps = detectChestReferenceJumps([
    {
      status: "measured",
      weight: 0,
      selectedChestHeightFraction: 0.75,
    },
    {
      status: "measured",
      weight: 0.1,
      selectedChestHeightFraction: 0.745,
    },
  ], {
    normalStepFraction: 0.005,
    tolerance: 1e-10,
  });

  assert.equal(jumps.length, 0);
});

test("jump neighborhood includes one sample on either side", () => {
  assert.deepEqual(
    jumpNeighborhoodIndices(
      10,
      [{leftIndex: 4, rightIndex: 5}],
      1,
    ),
    [3, 4, 5, 6],
  );
});

test("underbust status changes remain explicit", () => {
  const transitions = detectUnderbustTransitions([
    {
      weight: 0,
      underbustReference: {
        status: "selected",
        selectedHeightFraction: 0.70,
      },
    },
    {
      weight: 0.1,
      underbustReference: {
        status: "no-stable-landmark",
        selectedHeightFraction: null,
      },
    },
  ]);

  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].kind, "status-change");
});

test("summarizes the strongest eligible chest candidates below appendage boundary", () => {
  const landscape = summarizeChestReferenceLandscape({
    status: "selected",
    selected: {
      heightFraction: 0.72,
      perimeterUnits: 9.5,
    },
    appendageMergeBoundary: {
      boundarySampleIndex: 4,
      boundaryHeightFraction: 0.74,
    },
    samples: [
      {
        index: 1,
        status: "candidate",
        heightFraction: 0.70,
        perimeterUnits: 9.0,
        loopCount: 3,
      },
      {
        index: 2,
        status: "candidate",
        heightFraction: 0.71,
        perimeterUnits: 9.3,
        loopCount: 3,
      },
      {
        index: 3,
        status: "candidate",
        heightFraction: 0.72,
        perimeterUnits: 9.5,
        loopCount: 3,
      },
      {
        index: 4,
        status: "excluded-above-appendage-merge",
        heightFraction: 0.74,
        perimeterUnits: 12,
        loopCount: 2,
      },
    ],
  });

  assert.equal(
    CHEST_REFERENCE_SWEEP_CONTRACT,
    "scc-chest-reference-sweep-audit-v0",
  );
  assert.equal(landscape.selectedHeightFraction, 0.72);
  assert.deepEqual(
    landscape.topEligibleCandidates.map(
      (candidate) => candidate.heightFraction,
    ),
    [0.72, 0.71, 0.70],
  );
});
