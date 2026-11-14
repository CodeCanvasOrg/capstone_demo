import { useEffect, useState } from 'react'
import { Bee } from './bee'

const PHRASES = [
  'Buzzing through your notes…',
  'Gathering the sweetest facts…',
  'Pollinating ideas…',
  'Sketching the story arc…',
  'Choosing just the right words…',
  'Tucking in your citations…',
  'Smoothing out the honey…',
  'Lining up the layout…',
  'Almost ready to land…',
]

const INTERVAL = 3200

/**
 * Bo keeps the user company while a draft is generated, chatting in a speech bubble the way
 * Claude Code's spinner does. The bubble is aria-hidden so screen readers hear one stable
 * status instead of a new announcement every few seconds.
 */
export function BeeWorking({ label = 'Generating your draft. Saved content is safe.' }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % PHRASES.length),
      INTERVAL
    )
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div role="status" className="bee-working">
      <span className="sr-only">{label}</span>
      <div className="bee-working-bee" aria-hidden="true">
        <Bee mood="work" />
      </div>
      <div className="bee-working-bubble" aria-hidden="true">
        <p key={index} className="bee-working-line">
          {PHRASES[index]}
        </p>
        <p className="bee-working-note">Saved content is safe.</p>
      </div>
    </div>
  )
}
