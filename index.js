const fs = require("fs");
const math = require("mathjs");

// without checks
// ~800k / s
// from 1 Billion marble movements, 100k 2 marble scenarios

// with identical checks only
// NOTE: Speed slows down progressively!
//  1M UIDs: ~100k / s

const runID = String(Math.round(Math.random() * 100000)).padStart(6, "0");
const layout = [
  { x: 2, y: 0 },
  { x: 3, y: 0 },
  { x: 4, y: 0 },
  { x: 2, y: 1 },
  { x: 3, y: 1 },
  { x: 4, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
  { x: 6, y: 2 },
  { x: 0, y: 3 },
  { x: 1, y: 3 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 3 },
  { x: 5, y: 3 },
  { x: 6, y: 3 },
  { x: 0, y: 4 },
  { x: 1, y: 4 },
  { x: 2, y: 4 },
  { x: 3, y: 4 },
  { x: 4, y: 4 },
  { x: 5, y: 4 },
  { x: 6, y: 4 },
  { x: 2, y: 5 },
  { x: 3, y: 5 },
  { x: 4, y: 5 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
];
const bounds = {
  min: { x: 0, y: 0 },
  max: { x: 6, y: 6 },
};

const calcPossibleMoves = (state) => {
  const tStart = performance.now();
  const marblesCount = state.length;
  const possibleMoves = [];
  state.forEach((marble) => {
    // (1) Find any of 4 potential neighbor marbles (left, right, up, down)
    const { x, y } = marble;
    let neighborLeft;
    let obstructingLeft;
    let neighborRight;
    let obstructingRight;
    let neighborTop;
    let obstructingTop;
    let neighborBottom;
    let obstructingBottom;
    state.forEach((otherMarble) => {
      if (otherMarble.y === y && otherMarble.x === x - 1) {
        neighborLeft = otherMarble;
      } else if (otherMarble.y === y && otherMarble.x === x - 2) {
        obstructingLeft = otherMarble;
      } else if (otherMarble.y === y && otherMarble.x === x + 1) {
        neighborRight = otherMarble;
      } else if (otherMarble.y === y && otherMarble.x === x + 2) {
        obstructingRight = otherMarble;
      }
      if (otherMarble.x === x && otherMarble.y === y - 1) {
        neighborBottom = otherMarble;
      } else if (otherMarble.x === x && otherMarble.y === y - 2) {
        obstructingBottom = otherMarble;
      } else if (otherMarble.x === x && otherMarble.y === y + 1) {
        neighborTop = otherMarble;
      } else if (otherMarble.x === x && otherMarble.y === y + 2) {
        obstructingTop = otherMarble;
      }
    });
    if (
      neighborLeft &&
      !obstructingLeft &&
      x > bounds.min.x + 1 &&
      layout.find((tile) => tile.x === x - 2 && tile.y === y)
    ) {
      possibleMoves.push({
        marble,
        offset: { x: -2, y: 0 },
        eatingMarble: neighborLeft,
      });
    }
    if (
      neighborRight &&
      !obstructingRight &&
      x < bounds.max.x - 1 &&
      layout.find((tile) => tile.x === x + 2 && tile.y === y)
    ) {
      possibleMoves.push({
        marble,
        offset: { x: 2, y: 0 },
        eatingMarble: neighborRight,
      });
    }
    if (
      neighborBottom &&
      !obstructingBottom &&
      y > bounds.min.y + 1 &&
      layout.find((tile) => tile.y === y - 2 && tile.x === x)
    ) {
      possibleMoves.push({
        marble,
        offset: { x: 0, y: -2 },
        eatingMarble: neighborBottom,
      });
    }
    if (
      neighborTop &&
      !obstructingTop &&
      y < bounds.max.y - 1 &&
      layout.find((tile) => tile.y === y + 2 && tile.x === x)
    ) {
      possibleMoves.push({
        marble,
        offset: { x: 0, y: 2 },
        eatingMarble: neighborTop,
      });
    }
  });
  const tEnd = performance.now();
  //   console.log(
  //     `\tcalcPossibleMoves for ${marblesCount} marbles took ${(
  //       tEnd - tStart
  //     ).toFixed(3)} ms`
  //   );
  return possibleMoves;
};

const applyMove = (state, move) => {
  const { marble, offset, eatingMarble } = move;
  const newState = state.slice();
  const movedMarble = { x: marble.x + offset.x, y: marble.y + offset.y };
  const iMarble = newState.indexOf(marble);
  const iEatingMarble = newState.indexOf(eatingMarble);
  if (iMarble < 0 || iEatingMarble < 0) {
    throw new Error(`applyMove failed sanity test`);
  }
  newState.splice(iMarble, 1, movedMarble);
  newState.splice(iEatingMarble, 1);
  return newState;
};

const calcStateUID = (() => {
  const marbleUIDs = new Array(bounds.max.x + 1)
    .fill(0)
    .map((_) => new Array(bounds.max.y + 1).fill(0));
  layout.forEach((cell) => {
    marbleUIDs[cell.x][cell.y] = 2 ** (cell.x + cell.y * (bounds.max.x + 1));
  });
  return (state) => {
    let id = 0;
    state.forEach((marble) => {
      id += marbleUIDs[marble.x][marble.y];
    });
    return id;
  };
})();

const areStatesIdentical = (() => {
  const matrixFlipAroundPoint = (planeXorY, point) => {
    // translate point so that center of coord system is at point
    const matTranslateInverse = math.matrix([
      [1, 0, -point.x],
      [0, 1, -point.y],
      [0, 0, 1],
    ]);
    // inverse desired plane
    const matInversePlane = math.matrix([
      [planeXorY === "x" ? -1 : 1, 0, 0],
      [0, planeXorY === "y" ? -1 : 1, 0],
      [0, 0, 1],
    ]);
    // translate back
    const matTranslate = math.matrix([
      [1, 0, point.x],
      [0, 1, point.y],
      [0, 0, 1],
    ]);
    const a = math.multiply(matInversePlane, matTranslateInverse);
    const b = math.multiply(matTranslate, a);
    return b;
  };
  const matrixRotationAroundPoint = (ang, point) => {
    // https://math.stackexchange.com/a/2093322
    const matTranslate = math.matrix([
      [1, 0, point.x],
      [0, 1, point.y],
      [0, 0, 1],
    ]);
    const matTranslateInverse = math.matrix([
      [1, 0, -point.x],
      [0, 1, -point.y],
      [0, 0, 1],
    ]);
    const matRotate = math.matrix([
      [Math.cos(ang), -Math.sin(ang), 0],
      [Math.sin(ang), Math.cos(ang), 0],
      [0, 0, 1],
    ]);
    const a = math.multiply(matRotate, matTranslateInverse);
    const b = math.multiply(matTranslate, a);
    return b;
  };
  // For definitely non integer coord, e.g. `3.73232`, return `false`, otherwise return properly rounded Number.
  const checkCoordInteger = (coord) => {
    const diffRounded = Math.abs(Math.round(coord) - coord);
    if (diffRounded < 0.01) {
      return Math.round(coord);
    }
    return false;
  };
  // Can return `undefined`
  const applyStateTransformation = (state, matrix) => {
    const transformedState = [];
    let anyMarbleDidntFitExactly = false;
    state.forEach((marble) => {
      const marbleMat = math.matrix([marble.x, marble.y, 1]);
      const marbleTransformed = math.multiply(matrix, marbleMat).valueOf();
      const x = checkCoordInteger(marbleTransformed[0]);
      const y = checkCoordInteger(marbleTransformed[1]);
      if (x === false || y === false) {
        anyMarbleDidntFitExactly = true;
        return;
      }
      transformedState.push({ x, y });
    });
    return anyMarbleDidntFitExactly ? undefined : transformedState;
  };
  const stateExactlyIdentical = (state1, state2) => {
    if (state1.length !== state2.length) {
      return false;
    }
    for (const marble of state1) {
      if (
        !state2.find(
          (marble2) => marble2.x === marble.x && marble2.y === marble.y
        )
      ) {
        return false;
      }
    }
    return true;
  };

  const center = { x: 3, y: 3 };
  const transforms = [
    // {
    //   label: "flipx",
    //   matrix: matrixFlipAroundPoint("x", center),
    // },
    // {
    //   label: "flipy",
    //   matrix: matrixFlipAroundPoint("y", center),
    // },
    // {
    //   label: "rotate90",
    //   matrix: matrixRotationAroundPoint((Math.PI * 2) / 4, center),
    // },
    // {
    //   label: "rotate180",
    //   matrix: matrixRotationAroundPoint((Math.PI * 4) / 4, center),
    // },
    // {
    //   label: "rotate270",
    //   matrix: matrixRotationAroundPoint((Math.PI * 6) / 4, center),
    // },
  ];

  return (state1, state2) => {
    if (state1.length !== state2.length) {
      return false;
    }

    if (stateExactlyIdentical(state1, state2)) {
      return "identical";
    }

    for (const transform of transforms) {
      const transformed = applyStateTransformation(state1, transform.matrix);
      if (stateExactlyIdentical(state2, transformed)) {
        return transform.label;
      }
    }
    return false;
  };
})();

const fastStateMap = (() => {
  const checkedStateUIDsSorted = [];
  // Returns either `true` or `Number` (index where the UID should be placed for array to remain sorted)
  const findExistingUIDOrReturnIndex = (uid) => {
    const lenUIDs = checkedStateUIDsSorted.length;
    if (lenUIDs === 0) {
      return false;
    }
    // binary search
    let iMin = 0;
    let iMax = lenUIDs - 1;
    let iNext = Math.round((iMin + iMax) / 2);
    while (true) {
      const iCur = iNext;
      const iUid = checkedStateUIDsSorted[iNext];
      // console.log("\tcheck", iMin, "-", iCur, "-", iMax, `(${iUid})`);
      if (iUid === uid) {
        return true;
      }
      if (iUid < uid) {
        iMin = iCur + 1;
        iNext = Math.round((iMin + iMax) / 2);
      } else {
        iMax = iCur - 1;
        iNext = Math.round((iMin + iMax) / 2);
      }
      if (iNext === iCur || iNext < 0 || iNext >= lenUIDs) {
        return iNext;
      }
    }
  };
  const checkMatch = (state) => {
    const stateUID = calcStateUID(state);
    const check = findExistingUIDOrReturnIndex(stateUID);
    // NOTE: Could just use includes instead of binary search. May be ~5x faster. However, binary search has to be used on top for fast sort.
    if (check === true) {
      return true;
    }
    // add state and all its mirrors / equivalent states to the cache and return false.
    checkedStateUIDsSorted.splice(check, 0, stateUID);
    // TODO: Transforms
    return false;
  };
  const getStateUIDsCount = () => checkedStateUIDsSorted.length;

  return { checkMatch, getStateUIDsCount };
})();

console.log(layout.length, "tiles");

// testcase_0
// const testCase = [
//   { x: 3, y: 6 },
//   { x: 3, y: 5 },
//   { x: 4, y: 4 },
//   { x: 3, y: 3 },
// ];

// testcase_1
// const testCase = [
//   { x: 0, y: 2 },
//   { x: 1, y: 2 },
//   { x: 0, y: 3 },
//   { x: 1, y: 3 },
// ];

// testcase (actual), no winning moves? :c
// const testCase = [
//   { x: 3, y: 0 },
//   { x: 4, y: 0 },
//   { x: 0, y: 2 },
//   { x: 1, y: 2 },
//   { x: 5, y: 2 },
//   { x: 0, y: 3 },
//   { x: 1, y: 3 },
//   { x: 3, y: 3 },
//   { x: 4, y: 4 },
//   { x: 3, y: 5 },
//   { x: 3, y: 6 },
// ];

// testcase (start of game)
const testCase = layout.filter((tile) => tile.x !== 3 || tile.y !== 3);

console.log(testCase.length, "marbles at start");
const movesAtStart = calcPossibleMoves(testCase);
const movesToCheck = movesAtStart.map((move) => ({
  move,
  state: testCase,
  previousMove: undefined,
}));
const runDebugHistory = [];
(async () => {
  let iteration = 0;
  const tStart = performance.now();
  let tPrevDebug = -10000;
  let depthMax = 0;
  let lastDepths = [];
  let lastMarbles = [];
  let marbles1Scenarios = [];
  let marbles2Scenarios = [];
  let skipsCount = 0;
  let sumStateCheckDelay = 0;
  let lastIterations = 0;
  while (true) {
    const moveToCheck = movesToCheck.pop();
    const moveDepth = (() => {
      let depth = 0;
      let previousMove = moveToCheck;
      do {
        previousMove = previousMove.previousMove;
        depth += 1;
      } while (previousMove);
      return depth;
    })();
    lastDepths.push(moveDepth);
    const marbleCount = moveToCheck.state.length;
    lastMarbles.push(marbleCount);
    depthMax = Math.max(depthMax, moveDepth);

    const tNow = performance.now();
    if (tNow - tPrevDebug >= 10000) {
      const avgDepth = lastDepths.reduce(
        (prev, cur) => prev + cur / lastDepths.length,
        0
      );
      const avgMarbles = lastMarbles.reduce(
        (prev, cur) => prev + cur / lastMarbles.length,
        0
      );
      const winScenariosCount = marbles1Scenarios.length;
      const marbles2LeftScenariosCount = marbles2Scenarios.length;
      const newIterationsCount = iteration - lastIterations;
      const state = {
        iteration,
        time: `${((tNow - tStart) / 1000).toFixed(1)} s`,
        newIterationsCount,
        movesToCheck: movesToCheck.length,
        avgDepth,
        avgMarbles,
        winCount: winScenariosCount,
        twoMarblesLeftCount: marbles2LeftScenariosCount,
        skipsCount: `${skipsCount} (${((skipsCount * 100) / iteration).toFixed(
          2
        )} %)`,
        stateCheckProcessTime: `${sumStateCheckDelay.toFixed(3)} ms`,
        getStateUIDsCount: fastStateMap.getStateUIDsCount(),
        depthMax,
      };
      console.log(state);
      runDebugHistory.push(state);
      fs.writeFile(
        `debug/run-${runID}-${performance.now().toFixed(0)}.json`,
        JSON.stringify(runDebugHistory),
        () => {}
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      tPrevDebug = tNow;
      lastDepths.length = 0;
      lastMarbles.length = 0;
      sumStateCheckDelay = 0;
      lastIterations = iteration;
    }

    const stateAfterMove = applyMove(moveToCheck.state, moveToCheck.move);

    const tStateCheckStart = performance.now();
    const shouldCheckPreviousState = stateAfterMove.length > 5;
    const matchingPreviousState =
      shouldCheckPreviousState && fastStateMap.checkMatch(stateAfterMove);
    const tStateCheckEnd = performance.now();
    // console.log(
    //   `\tIdentical state check took ${(
    //     tStateCheckEnd - tStateCheckStart
    //   ).toFixed(3)} ms`
    // );
    sumStateCheckDelay += tStateCheckEnd - tStateCheckStart;
    if (!matchingPreviousState) {
      const possibleMovesAfterwards = calcPossibleMoves(stateAfterMove);
      const newMovesToCheck = possibleMovesAfterwards.map((move) => ({
        state: stateAfterMove,
        move,
        previousMove: moveToCheck,
      }));
      movesToCheck.push.apply(movesToCheck, newMovesToCheck);

      if (stateAfterMove.length === 1) {
        console.log(`\tWOOP Win scenario detected!`);
        marbles1Scenarios.push(moveToCheck);
        fs.writeFileSync(
          `debug/win_${iteration}.json`,
          JSON.stringify(moveToCheck)
        );
      } else if (stateAfterMove.length === 2) {
        // console.log(`\t2 marbles scenario!`);
        marbles2Scenarios.push(moveToCheck);
        // fs.writeFileSync(
        //   `debug/2-marbles_${iteration}.json`,
        //   JSON.stringify(moveToCheck)
        // );
      }
    } else {
      // Skipped due to state checked before
      skipsCount += 1;
      // const matchJustificationLabel = matchingPreviousState;
      // skipsCount[matchJustificationLabel] =
      //   matchJustificationLabel in skipsCount
      //     ? skipsCount[matchJustificationLabel] + 1
      //     : 1;
    }

    if (movesToCheck.length === 0) {
      break;
    }
    iteration += 1;
  }
  console.log(
    `checked all possible moves in ${iteration} iterations and ${(
      (performance.now() - tStart) /
      1000
    ).toFixed(1)} seconds, skipped ${JSON.stringify(skipsCount)}, found ${
      marbles1Scenarios.length
    } winning scenarios`
  );
})();
