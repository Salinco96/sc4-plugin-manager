export function difference<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): T[] {
  return array.filter(v => !values.includes(v))
}

export function hasAny<T>(array: ReadonlyArray<T>, values: ReadonlyArray<T>): boolean {
  return array.some(v => values.includes(v))
}

export function removeElement<T>(array: ReadonlyArray<T>, value: T): T[] {
  return array.filter(v => v !== value)
}

export function toggleElement<T>(array: ReadonlyArray<T>, value: T): T[] {
  return array.includes(value) ? array.filter(v => v !== value) : [...array, value]
}

export function removeElement$<T>(array: T[], element: T): boolean {
  const index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  } else {
    return false
  }
}
