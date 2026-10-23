/**
 * Explicit opt-in. A Railway hostname or NODE_ENV=production never implies
 * staging: deployed Vite builds use NODE_ENV=production in both environments.
 */
export function isStagingEnvironment(value) {
  return value === "staging";
}

export const POINTVET_IS_STAGING = isStagingEnvironment(
  import.meta.env?.VITE_POINTVET_ENVIRONMENT
);
