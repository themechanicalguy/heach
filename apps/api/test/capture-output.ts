/** Records everything the process writes to stdout and stderr until `stop` is called. */
export function captureOutput(): { text: () => string; stop: () => void } {
  let text = '';
  const saved = [process.stdout, process.stderr].map((stream) => ({
    stream,
    original: stream.write.bind(stream),
  }));
  for (const { stream, original } of saved) {
    const capture = (chunk: string | Uint8Array, ...rest: never[]): boolean => {
      text += String(chunk);
      return original(chunk, ...rest);
    };
    stream.write = capture;
  }
  return {
    text: () => text,
    stop: () => {
      for (const { stream, original } of saved) {
        stream.write = original;
      }
    },
  };
}
