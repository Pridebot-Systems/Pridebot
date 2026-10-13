const EXPIRED_CODES = new Set([10008, 10062, 40060, 50027]);

function safeCollect(label, handler) {
  return async (i) => {
    try {
      await handler(i);
    } catch (error) {
      if (EXPIRED_CODES.has(error?.code)) {
        console.warn(
          `[WARN] ${error.code} in ${label} collector (${i.customId}) — interaction expired or already responded to.`,
        );
        return;
      }
      throw error;
    }
  };
}

module.exports = safeCollect;
