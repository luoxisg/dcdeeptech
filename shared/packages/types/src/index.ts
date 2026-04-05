/**
 * @shared/types
 *
 * Cross-boundary TypeScript interfaces for the sg-gateway and sg-compliance public APIs.
 *
 * Two-consumer rule: nothing enters this package unless consumed by packages
 * in two different top-level planes (front/ and platform-sg/).
 *
 * No-business-logic rule: this package contains only interface/type definitions.
 * No functions, no classes, no runtime code.
 */

export * from "./api/keys";
export * from "./api/usage";
export * from "./api/compliance";
