const logger = require('../logger');

class Queue {
  constructor(params) {
    this.elements = [];
    this.results = [];
    this.maxConcurrentProcess = params.maxConcurrentProcess;
    this.currentProcessing = 0;
    this.processFunction = params.processFunction;
  }

  // Getter
  get length() {
    return this.elements.length;
  }

  enqueue(data) {
    if (Array.isArray(data)) {
      this.elements = [...this.elements, ...data];
    } else {
      this.elements.push(data);
    }
    this.process();
  }

  dequeue() {
    const firstElement = this.elements[0];
    this.elements = this.elements.slice(1);
    return firstElement;
  }

  async process() {
    if (
      this.elements.length > 0 &&
      this.currentProcessing < this.maxConcurrentProcess
    ) {
      const nextData = this.dequeue();
      this.currentProcessing++;
      logger.info(
        `Processing next queue. Left in Queue: ${this.elements.length}, Currently Processing: ${this.currentProcessing}`,
      );
      this.processFunction(nextData).then((result) => {
        this.results.push(result);
        this.currentProcessing--;
        this.process();
      });
      this.process();
    }
  }

  async waitFinish() {
    return new Promise((resolve) => {
      let timerId = setInterval(() => {
        if (this.currentProcessing === 0 && this.elements.length === 0) {
          clearInterval(timerId);
          resolve(this.results.flat());
        }
      }, 5000);
    });
  }
}

module.exports = Queue;
