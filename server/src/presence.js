// ─── Présence : qui est en ligne (par userId) ────────────────────────────────
const counts = new Map(); // userId → nombre de sockets connectés

function add(userId) {
  counts.set(userId, (counts.get(userId) || 0) + 1);
}

function remove(userId) {
  const c = (counts.get(userId) || 0) - 1;
  if (c <= 0) counts.delete(userId);
  else counts.set(userId, c);
}

function isOnline(userId) {
  return counts.has(userId);
}

module.exports = { add, remove, isOnline };
