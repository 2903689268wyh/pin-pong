const test = require("node:test");
const assert = require("node:assert/strict");
const { CRITERIA_TEMPLATE, weightedScore, gradeFor, formatTime, parseTime } = require("../js/score.js");

test("template weights add up to a 100-point sheet", () => {
  const total = CRITERIA_TEMPLATE.reduce((sum, item) => sum + item.weight, 0);
  assert.equal(total, 100);
  assert.equal(new Set(CRITERIA_TEMPLATE.map((item) => item.key)).size, CRITERIA_TEMPLATE.length);
});

test("equal weights average the ten-point scores into a percentage", () => {
  assert.equal(
    weightedScore([
      { score: 10, weight: 1 },
      { score: 0, weight: 1 },
    ]),
    50
  );
});

test("heavier criteria move the total", () => {
  assert.equal(
    weightedScore([
      { score: 10, weight: 3 },
      { score: 0, weight: 1 },
    ]),
    75
  );
});

test("a sheet with no weight scores zero", () => {
  assert.equal(weightedScore([{ score: 10, weight: 0 }]), 0);
  assert.equal(weightedScore([]), 0);
});

test("out of range scores are pulled back before weighting", () => {
  assert.equal(weightedScore([{ score: 80, weight: 10 }]), 100);
  assert.equal(weightedScore([{ score: -4, weight: 10 }]), 0);
});

test("grade bands", () => {
  assert.deepEqual(gradeFor(90), { letter: "S", label: "出色" });
  assert.equal(gradeFor(89.9).letter, "A");
  assert.equal(gradeFor(80).letter, "A");
  assert.equal(gradeFor(70).letter, "B");
  assert.equal(gradeFor(60).letter, "C");
  assert.equal(gradeFor(59.9).letter, "D");
});

test("timecode parses seconds and mm:ss", () => {
  assert.equal(parseTime("12.4"), 12.4);
  assert.equal(parseTime("90"), 90);
  assert.equal(parseTime("1:02.5"), 62.5);
  assert.equal(parseTime("01:02.50"), 62.5);
  assert.equal(parseTime(""), 0);
  assert.equal(parseTime("   "), 0);
  assert.equal(parseTime("nope"), null);
  assert.equal(parseTime("1:60"), null);
  assert.equal(formatTime(62.5), "01:02.50");
  assert.equal(formatTime(-3), "00:00.00");
});
