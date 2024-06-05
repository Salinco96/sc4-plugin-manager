export function removeElement<T>(array: T[], element: T): boolean {
  const index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
    return true
  } else {
    return false
  }
}
