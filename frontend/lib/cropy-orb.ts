export function orbContour(phase: number, intensity = 1): string {
  const radius = 46 - (intensity - 1) * .5;
  const top = radius + Math.sin(phase * .57) * 1.1 * intensity;
  const right = radius + Math.sin(phase * .43 + 1.2) * .9 * intensity;
  const bottom = radius + Math.sin(phase * .51 + 2.4) * 1.1 * intensity;
  const left = radius + Math.sin(phase * .39 + 3.6) * .9 * intensity;
  const k = .55228475;
  return `M 50 ${50 - top}
    C ${50 + right * k} ${50 - top} ${50 + right} ${50 - top * k} ${50 + right} 50
    C ${50 + right} ${50 + bottom * k} ${50 + right * k} ${50 + bottom} 50 ${50 + bottom}
    C ${50 - left * k} ${50 + bottom} ${50 - left} ${50 + bottom * k} ${50 - left} 50
    C ${50 - left} ${50 - top * k} ${50 - left * k} ${50 - top} 50 ${50 - top} Z`;
}
