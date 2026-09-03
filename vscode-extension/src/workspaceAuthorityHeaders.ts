const WORKSPACE_ID_HEADER = "x-workspace-id";
const WORKSPACE_ID_PATTERN = /^ws_[a-f0-9]{24}$/i;

/**
 * Copy request headers and make the workspace authority match the bootstrap
 * body. An empty target deliberately removes any prior workspace authority so
 * the server can apply its default-workspace semantics.
 */
export function workspaceAuthorityHeaders(existing: HeadersInit, targetWorkspaceId: string): Headers {
  const headers = new Headers(existing);
  if (targetWorkspaceId.trim()) {
    headers.set(WORKSPACE_ID_HEADER, targetWorkspaceId);
  } else {
    headers.delete(WORKSPACE_ID_HEADER);
  }
  return headers;
}

/**
 * Accept a bootstrap response only for the authority requested by this
 * attempt. A blank request deliberately permits the server-selected default.
 */
export function workspaceAuthorityResponseAcceptable(
  responseOk: boolean,
  requestedWorkspaceId: string,
  returnedWorkspaceId: unknown,
): returnedWorkspaceId is string {
  if (!responseOk || typeof returnedWorkspaceId !== "string" || !WORKSPACE_ID_PATTERN.test(returnedWorkspaceId)) {
    return false;
  }
  return requestedWorkspaceId === "" || returnedWorkspaceId === requestedWorkspaceId;
}
