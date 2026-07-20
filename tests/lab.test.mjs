import assert from "node:assert/strict";
import test from "node:test";
import { failureFixture, initialLabState, reduceLabEvent, successFixture } from "../lib/lab.ts";

test("success fixture reaches the user approval boundary", () => {
  const state = successFixture.reduce(reduceLabEvent, initialLabState);
  assert.equal(state.status, "waiting");
  assert.equal(state.progress, 80);
  assert.equal(state.tool, null);
  assert.match(state.message, /portability and control/);
});

test("user submission closes the run", () => {
  const waiting = successFixture.reduce(reduceLabEvent, initialLabState);
  const submitted = [
    { type: "USER_ACTION", payload: { action: "approve_recommendation" } },
    { type: "RUN_FINISHED", payload: { outcome: "submitted" } },
  ].reduce(reduceLabEvent, waiting);
  assert.equal(submitted.status, "finished");
  assert.equal(submitted.progress, 100);
  assert.equal(submitted.events.at(-2).type, "USER_ACTION");
});

test("failure fixture is retryable and does not falsely finish", () => {
  const state = failureFixture.reduce(reduceLabEvent, initialLabState);
  assert.equal(state.status, "error");
  assert.notEqual(state.progress, 100);
  assert.equal(state.events.at(-1).payload.retryable, true);
});
