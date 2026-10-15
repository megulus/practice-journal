/**
 * Confirmation copy for destructive actions.
 *
 * Every `ConfirmDialog` in the app pulls its wording from here so the same
 * guarantee reads the same way everywhere. The shape is fixed:
 *
 *   title    — a question naming the target: `Delete “Scales”?`
 *   message  — what the action does, then any cascade, then how permanent it is
 *
 * Naming the target in the title is the point: a stray tap that opens the wrong
 * row is caught by reading the name, not by reading the verb.
 */

export interface ConfirmCopy {
  title: string
  message: string
}

/** `2 plans`, `1 plan` — the cascade counts read as prose, not as `1 plan(s)`. */
export function count(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}

/**
 * A cascade sentence: what else goes when the target does.
 *
 * Phrased as "Deleting it also removes …" on purpose — that hangs the verb off
 * the gerund, so it stays singular no matter what `n` is and can't disagree
 * with the count the way "Its 1 block go too." did. The only word that still
 * has to agree is the trailing pronoun, and it agrees here, next to `count()`,
 * rather than at each call site where it drifted.
 *
 *   alsoRemoves(1, 'block')  → 'Deleting it also removes its 1 block.'
 *   alsoRemoves(2, 'block')  → 'Deleting it also removes its 2 blocks.'
 *   alsoRemoves(1, 'section', { andContents: true })
 *     → 'Deleting it also removes its 1 section and everything in it.'
 */
export function alsoRemoves(
  n: number,
  singular: string,
  opts: { plural?: string; andContents?: boolean } = {},
): string {
  const contents = opts.andContents
    ? ` and everything in ${n === 1 ? 'it' : 'them'}`
    : ''
  return `Deleting it also removes its ${count(n, singular, opts.plural)}${contents}.`
}

/**
 * Copy for deleting `name` (a `noun` — "plan", "block", "instrument").
 *
 * `cascade` lines are whole sentences describing what else goes; they land
 * between the lead and the permanence line. `note` is a closing sentence for
 * a gentler alternative ("Retire it instead to keep the history").
 */
export function deleteConfirmCopy(
  noun: string,
  name: string,
  opts: { cascade?: string[]; note?: string } = {},
): ConfirmCopy {
  const sentences = [`This deletes the ${noun} “${name}”.`]
  if (opts.cascade?.length) sentences.push(...opts.cascade)
  sentences.push('This can’t be undone.')
  if (opts.note) sentences.push(opts.note)
  return { title: `Delete “${name}”?`, message: sentences.join(' ') }
}

/**
 * Copy for archiving `name`. Archiving is recoverable, so the closing line
 * says so rather than warning — the dialog is a speed bump, not a warning.
 */
export function archiveConfirmCopy(
  noun: string,
  name: string,
  opts: { cascade?: string[] } = {},
): ConfirmCopy {
  const sentences = [`This archives the ${noun} “${name}”.`]
  if (opts.cascade?.length) sentences.push(...opts.cascade)
  sentences.push('You can bring it back anytime.')
  return { title: `Archive “${name}”?`, message: sentences.join(' ') }
}
