import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { duelView, roomView } from '../../test/fixtures'
import { DuelTv } from './DuelTv'

const room = roomView({ status: 'in_game', round: 1, seats: [1, 2] })

describe('DuelTv', () => {
  it('shows the city, who plays which side, the tally, the prompt and the log', () => {
    render(
      <DuelTv
        room={room}
        duel={{
          view: duelView({
            kills: 3,
            discard: [30, 31],
            lastShift: { line: { axis: 'row', index: 1 }, by: 1, length: 5 },
          }),
          legal: [],
          events: [
            { t: 'you_drew', cards: [1] },
            { t: 'shifted', seat: 1, line: { axis: 'row', index: 1 }, by: 1 },
          ],
        }}
      />,
    )
    expect(screen.getByRole('group', { name: 'The city' })).toBeInTheDocument()
    expect(screen.getByText('Killer').closest('li')).toHaveTextContent('Ann')
    expect(screen.getByText('Ann').closest('li')).toHaveAttribute('data-moving')
    expect(screen.getByText('Turn 3')).toBeInTheDocument()
    expect(screen.getByText('3 of 14')).toBeInTheDocument()
    expect(document.querySelectorAll('.kill-meter__stroke[data-done]')).toHaveLength(3)
    expect(screen.getByRole('status')).toHaveTextContent('Ann to move.')
    expect(screen.getByText('Bob shifted row 2 right.')).toBeInTheDocument()
    expect(screen.queryByText('You drew Abe.')).toBeNull()
    expect(screen.getByText('20 cards left in the deck')).toBeInTheDocument()
    expect(screen.getByText('Face up: Rosalind, Quincy')).toBeInTheDocument()
  })

  it('ends with the verdict, the reveal and what happens next', () => {
    render(
      <DuelTv
        room={{ ...room, status: 'finished' }}
        status="Waiting for Ann to start the next round"
        duel={{
          view: duelView({
            pending: undefined,
            deckCount: 1,
            outcome: { winners: [1], reason: 'killer_caught' },
          }),
          legal: [],
          events: [],
        }}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Case closed Bob wins' })).toBeInTheDocument()
    expect(screen.getByText('The inspector caught the killer.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByText('Waiting for Ann to start the next round')).toBeInTheDocument()
    expect(screen.getByText('Nothing has happened yet.')).toBeInTheDocument()
    expect(screen.getByText('1 card left in the deck')).toBeInTheDocument()
    expect(document.querySelector('[data-moving]')).toBeNull()
  })
})
