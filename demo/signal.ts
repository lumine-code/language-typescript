type Sample = {
  time: number;
  amplitude: number;
};

export function average(samples: readonly Sample[]): number {
  const total = samples.reduce((sum, sample) => sum + sample.amplitude, 0);
  return samples.length === 0 ? 0 : total / samples.length;
}

export class SignalBuffer {
  private readonly samples: Sample[] = [];

  append(sample: Sample): this {
    this.samples.push(sample);
    return this;
  }

  snapshot(): readonly Sample[] {
    return [...this.samples];
  }
}

const signal = new SignalBuffer().append({ time: 0, amplitude: 0.5 });
console.log(average(signal.snapshot()));
