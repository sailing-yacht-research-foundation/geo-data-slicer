class Queue {
  constructor(params) {
    console.log(params);
    this.elements = [];
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

  process() {
    if (
      this.elements.length > 0 &&
      this.currentProcessing < this.maxConcurrentProcess
    ) {
      const nextData = this.dequeue();
      this.currentProcessing++;
      this.processFunction(nextData).then(() => {
        // Release this specific process
        this.currentProcessing--;
        this.process();
      });
      this.process();
    }
  }
}

module.exports = Queue;
