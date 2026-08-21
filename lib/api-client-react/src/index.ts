export * from "./generated/api";
export * from "./generated/api.schemas";
// customFetch is exported so hand-written calls (the Agora token endpoint,
// which is not in the OpenAPI spec) reuse the same base URL and auth header.
export { customFetch, setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
