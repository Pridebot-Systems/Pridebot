class Timeout {
  #timeout;

  constructor(ab, tm) {
    this.#timeout = null;
    this.promise = new Promise(resolve => {
      ab.signal.addEventListener('abort', () => {
        if (this.#timeout !== null) {
          clearTimeout(this.#timeout);

          this.#timeout = null;
        }

        resolve(null);
      })

      if (tm && tm !== Infinity) {
        this.#timeout = setTimeout(() => {
          resolve(null);
        }, tm);
      }
    });
  }
}

module.exports = { Timeout };