/**
 * The line copied when a capture is *not* filed: "copy and go".
 *
 * A terminal cannot paste an image, so the screenshot is written to a file and
 * the clipboard gets a sentence naming it. One line on purpose — a terminal
 * reads a newline as Enter, which would submit half a prompt.
 */
export function quickPrompt(note: string, imagePath: string): string {
  const said = note.replace(/\s+/g, ' ').trim()
  const sentence = said ? (/[.!?]$/.test(said) ? said : `${said}.`) : ''
  return sentence
    ? `${sentence} Here is a screenshot of it: ${imagePath} — read the image file.`
    : `Take a look at this screenshot: ${imagePath} — read the image file.`
}
