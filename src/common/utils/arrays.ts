export function hasAny<T>(array: T[], values: T[]): boolean {
  return array.some(value => values.includes(value))
}

export function removeElement<T>(array: T[], element: T): boolean {
  const index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  } else {
    return false
  }
}
