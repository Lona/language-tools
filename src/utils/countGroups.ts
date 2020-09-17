export default function countGroups(regExp: string | RegExp): number {
  const pattern = typeof regExp === 'string' ? regExp : regExp.source

  const alwaysMatches = new RegExp(pattern + '|')

  if (!alwaysMatches) {
    throw new Error('Invalid RegExp')
  }

  return (alwaysMatches.exec('') || []).length - 1
}
