declare module 'shruti-onnx' {
  export function createShruti(options: {ort: unknown; language: string}): Promise<{transcribe(samples: Float32Array, options?: {loops?: string}): Promise<{text: string}>}>;
}
