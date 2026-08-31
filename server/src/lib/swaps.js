export const MAX_PENDING_REQUESTS = 3;

export function atPendingCap(count) {
  return count >= MAX_PENDING_REQUESTS;
}
