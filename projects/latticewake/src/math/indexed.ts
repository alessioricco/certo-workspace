export function at<T>(items: ArrayLike<T>, index: number): T {
  const value = items[index];
  if (value === undefined) throw new RangeError('Index outside preallocated storage.');
  return value;
}
