import assert from "node:assert/strict";
import {
  workspaceAuthorityHeaders,
  workspaceAuthorityResponseAcceptable,
} from "./workspaceAuthorityHeaders";

const previousWorkspaceId = "ws_f61166c42849c757cf219c37";
const targetWorkspaceId = "ws_bca860d02b9ea61f6028bfb4";
const otherWorkspaceId = "ws_48ca5c119d5a48a0bc5d7f02";
const baseHeaders = {
  Authorization: "Bearer test-token",
  "x-client-id": "client_extension_selftest",
  "Content-Type": "application/json",
  "x-action-operation-id": "op_selftest_0001",
  "X-WoRkSpAcE-Id": previousWorkspaceId,
  "x-preserved": "preserved-value",
};

function distinctWorkspaceIds(headers: Headers, bodyWorkspaceId: string): string[] {
  return [...new Set([
    headers.get("x-workspace-id"),
    bodyWorkspaceId,
  ].filter((value): value is string => Boolean(value)))];
}

// Causal baseline: the old composition supplied two distinct workspace identities.
const staleBootstrapHeaders = new Headers(baseHeaders);
assert.deepEqual(distinctWorkspaceIds(staleBootstrapHeaders, targetWorkspaceId), [
  previousWorkspaceId,
  targetWorkspaceId,
]);

const recordSnapshot = { ...baseHeaders };
const repairedFromRecord = workspaceAuthorityHeaders(baseHeaders, targetWorkspaceId);
assert.notStrictEqual(repairedFromRecord, baseHeaders);
assert.equal(repairedFromRecord.get("x-workspace-id"), targetWorkspaceId);
assert.equal(repairedFromRecord.get("X-WORKSPACE-ID"), targetWorkspaceId);
assert.equal(repairedFromRecord.get("authorization"), baseHeaders.Authorization);
assert.equal(repairedFromRecord.get("x-client-id"), baseHeaders["x-client-id"]);
assert.equal(repairedFromRecord.get("content-type"), baseHeaders["Content-Type"]);
assert.equal(repairedFromRecord.get("x-action-operation-id"), baseHeaders["x-action-operation-id"]);
assert.equal(repairedFromRecord.get("x-preserved"), baseHeaders["x-preserved"]);
assert.deepEqual(baseHeaders, recordSnapshot);
assert.deepEqual(distinctWorkspaceIds(repairedFromRecord, targetWorkspaceId), [targetWorkspaceId]);

const sourceHeaders = new Headers(baseHeaders);
const repairedFromHeaders = workspaceAuthorityHeaders(sourceHeaders, targetWorkspaceId);
assert.notStrictEqual(repairedFromHeaders, sourceHeaders);
assert.equal(sourceHeaders.get("x-workspace-id"), previousWorkspaceId);
assert.equal(sourceHeaders.get("x-preserved"), baseHeaders["x-preserved"]);
assert.equal(repairedFromHeaders.get("x-workspace-id"), targetWorkspaceId);

const fallbackHeaders = workspaceAuthorityHeaders(sourceHeaders, "");
assert.equal(fallbackHeaders.has("x-workspace-id"), false);
assert.equal(fallbackHeaders.get("authorization"), baseHeaders.Authorization);
assert.equal(fallbackHeaders.get("x-client-id"), baseHeaders["x-client-id"]);
assert.equal(fallbackHeaders.get("content-type"), baseHeaders["Content-Type"]);
assert.equal(fallbackHeaders.get("x-action-operation-id"), baseHeaders["x-action-operation-id"]);
assert.equal(fallbackHeaders.get("x-preserved"), baseHeaders["x-preserved"]);
assert.equal(sourceHeaders.get("x-workspace-id"), previousWorkspaceId);

assert.equal(workspaceAuthorityResponseAcceptable(true, targetWorkspaceId, targetWorkspaceId), true);
assert.equal(workspaceAuthorityResponseAcceptable(true, targetWorkspaceId, otherWorkspaceId), false);
assert.equal(workspaceAuthorityResponseAcceptable(true, "", targetWorkspaceId), true);
assert.equal(workspaceAuthorityResponseAcceptable(true, targetWorkspaceId, undefined), false);
assert.equal(workspaceAuthorityResponseAcceptable(false, targetWorkspaceId, targetWorkspaceId), false);
assert.equal(workspaceAuthorityResponseAcceptable(true, targetWorkspaceId, "not-a-workspace-id"), false);

console.log("workspaceAuthorityHeaders selftest: stale conflict prevented; fallback and preservation checks passed");
