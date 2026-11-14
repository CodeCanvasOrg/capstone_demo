/**
 * A stat value is a figure ("90%", "1,000", "2 weeks"), not a phrase. The stat
 * band shows the figure large; a word like "Faster" or "30-second" has nothing
 * to show at that size and belongs in the copy, not the band.
 */
const FIGURE =
  /^[~≈<>]?\s?[$€£]?\d[\d.,]*\s?(?:%|×|x|k|m|bn|ms|s|min|hrs?|days?|weeks?|months?|years?|\+)?$/i

export const isFigure = (value: string) => FIGURE.test(value.trim())
