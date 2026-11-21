import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BeeTour, TOUR_DONE_EVENT, WELCOME_TOUR_KEY, hasSeenTour, type TourStep } from './bee_guide'

const CREATE_TOUR_KEY = 'codecanvas:bee-tour-create'

const STEPS: TourStep[] = [
  {
    title: 'Let’s make your first case study',
    body: 'Four short steps and I’ll write the first draft for you. You can keep typing while I talk.',
    mood: 'wave',
  },
  {
    title: 'Start with the brief',
    body: 'Tell me what you worked on: the client, the problem, what you did and how it turned out. Rough notes are fine, or press Generate with AI and I’ll draft it from your sources.',
    mood: 'think',
    target: ['[data-tour=create-brief]'],
  },
  {
    title: 'Add your sources',
    body: 'Attach decks, reports or screenshots and I’ll pull the facts and numbers from them. Optional, but it makes the draft much richer.',
    mood: 'idle',
    target: ['[data-tour=create-sources]'],
    optional: true,
  },
  {
    title: 'Tell me how it should read',
    body: 'Tone, length, what to lead with. Leave it empty and I’ll use sensible defaults.',
    mood: 'idle',
    target: ['[data-tour=create-instructions]'],
  },
  {
    title: 'Keep it with a project',
    body: 'File the case study under a project so it sits next to the work it describes.',
    mood: 'idle',
    target: ['[data-tour=create-project]'],
    optional: true,
  },
  {
    title: 'Pick a look',
    body: 'Use a ready-made template, choose a design for each page, or let me pick the designs that fit your story.',
    mood: 'think',
    target: ['[data-tour=create-layout]'],
  },
  {
    title: 'Then hit Generate',
    body: 'Once there’s a brief, I’ll write the whole thing. You can edit every word afterwards.',
    mood: 'cheer',
    target: ['[data-tour=create-generate]'],
  },
]

/**
 * Part 2 of the tour: walks through the new case study form. It waits for the welcome tour,
 * and follows straight on from it when that tour is finished here.
 */
export function BeeCreateTour() {
  const [welcomed, setWelcomed] = useState(() => hasSeenTour(WELCOME_TOUR_KEY))

  useEffect(() => {
    if (welcomed) return
    const onDone = (event: Event) => {
      if ((event as CustomEvent<string>).detail === WELCOME_TOUR_KEY) setWelcomed(true)
    }
    window.addEventListener(TOUR_DONE_EVENT, onDone)
    return () => window.removeEventListener(TOUR_DONE_EVENT, onDone)
  }, [welcomed])

  return (
    <BeeTour
      steps={STEPS}
      storageKey={CREATE_TOUR_KEY}
      scope="page"
      autoStart={welcomed}
      finish={(done) => (
        <Button size="sm" onClick={done}>
          Got it
          <Check className="size-3.5" />
        </Button>
      )}
    />
  )
}
