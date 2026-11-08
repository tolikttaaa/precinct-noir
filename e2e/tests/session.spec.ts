import { expect, test } from '@playwright/test'
import { closes, closingShift, collapsePlan, distance, quietShift } from '../support/grid'
import type { Player } from '../support/player'
import { Session } from '../support/session'
import { fill } from '../support/texts'

type Reason = 'inspector_eliminated' | 'kill_quota' | 'killer_caught'

/** Who plays which side this round, read from each player's file. */
async function sides(session: Session): Promise<{ killer: Player; inspector: Player }> {
  for (const player of session.players)
    await expect(player.page.locator('.dossier__role')).toBeVisible()
  const [a, b] = session.players
  return (await a.role()) === 'killer' ? { killer: a, inspector: b } : { killer: b, inspector: a }
}

async function expectVerdict(session: Session, winner: Player, reason: Reason): Promise<void> {
  const tv = session.players[0].t
  await expect(session.outcome).toContainText(fill(tv.duel.over.winner, { name: winner.name }))
  await expect(session.outcome).toContainText(fill(tv.duel.over.reason[reason], { max: 14 }))
  for (const player of session.players) {
    const verdict = player.page.locator('.outcome')
    await expect(verdict).toContainText(fill(player.t.duel.over.winner, { name: winner.name }))
    // Even when the last move was made far down the board, the screen comes back up to the verdict.
    await expect(verdict.getByRole('heading').first()).toBeInViewport()
  }
}

/** Secrets belong on players only: the TV never shows a file or marks anyone's own card. */
async function expectTvKeepsSecrets(session: Session): Promise<void> {
  await expect(session.tv.locator('.dossier, [data-mine]')).toHaveCount(0)
}

test('a living-room session: a TV, a laptop and a phone play two rounds of Shadow Duel', async ({
  browser,
}) => {
  const session = await Session.open(browser, [
    ['Ann', 'en', 'laptop'],
    ['Борис', 'ru', 'phone'],
  ])
  const [ann, boris] = session.players
  try {
    await test.step('the TV opens a room; a laptop and a phone join it, the phone in Russian', async () => {
      const code = await session.openRoom()
      await expect(session.tv.getByText(code).first()).toBeVisible()
      await ann.join(code)
      await boris.join(code)
      for (const name of ['Ann', 'Борис'])
        await expect(session.tv.getByText(name, { exact: true }).first()).toBeVisible()
      await expect(ann.page.getByText(ann.t.lobby.youAreVip)).toBeVisible()
      const waiting = fill(boris.t.lobby.waitingForVip, { name: 'Ann' })
      await expect(boris.page.getByText(waiting)).toBeVisible()
    })

    await test.step('round 1: the killer closes the city up, then the inspector tracks them down', async () => {
      await ann.page.getByRole('button', { name: ann.t.lobby.start }).click()
      const { killer, inspector } = await sides(session)
      await expectTvKeepsSecrets(session)
      const k = await killer.identity()
      let i: number | undefined
      let cleared = false
      let collapsed = false
      await session.playRound(async (player) => {
        const prompt = await player.prompt()
        if (player === killer) {
          if (prompt === player.t.duel.yourPrompt.opening_kill) return player.firstKill()
          if (prompt === player.t.duel.yourPrompt.collapse_more) return player.stopCollapsing()
          i ??= await inspector.identity()
          const grid = await player.grid()
          if (!collapsed) {
            // The killer works towards closing the city up, sparing the inspector, and collapses it as soon
            // as every row or every column has a body. Until then, the tab says why it can't.
            expect(await player.available('collapse')).toBe(closes(grid))
            if (closes(grid)) {
              collapsed = true
              await player.collapse()
              return expect(session.tv.locator('.board__cell')).toHaveCount(
                grid.rows * grid.cols - 5,
              )
            }
            expect(await player.explanation('collapse')).toBe(player.t.duel.unavailable.collapse)
            const step = collapsePlan(grid, k, [i], await player.shifts(grid))
            if (step && 'kill' in step) return player.strike('kill', step.kill)
            if (step) return player.shift(step.shift)
          }
          // Otherwise it slides lines that move neither of them.
          return player.shift(quietShift(grid, [k, i], await player.shifts(grid)))
        }
        if (await player.picking()) {
          if (prompt === player.t.duel.yourPrompt.exonerate_discard)
            return void (await player.pick('exonerate_discard'))
          i = await player.pick('choose_identity')
          return
        }
        if (!cleared) {
          // The accuse tab lights who could be accused; switching to clearing a suspect needs no cancel.
          cleared = true
          expect((await player.targets('accuse')).length).toBeGreaterThan(0)
          return player.clearSuspect()
        }
        // The inspector waits out the collapse, then slides the killer next to them and accuses.
        i ??= await player.identity()
        const grid = await player.grid()
        if (!collapsed) return player.shift(quietShift(grid, [k, i], await player.shifts(grid)))
        if (distance(grid, k, i) <= 1) return player.strike('accuse', k)
        return player.shift(closingShift(grid, k, i, await player.shifts(grid)))
      })
      expect(collapsed).toBe(true)
      await expectVerdict(session, inspector, 'killer_caught')
      await expectTvKeepsSecrets(session)
    })

    await test.step('the VIP starts another round from the same room', async () => {
      const waiting = fill(boris.t.game.waitingForRematch, { name: 'Ann' })
      await expect(boris.page.getByText(waiting)).toBeVisible()
      await ann.page.getByRole('button', { name: ann.t.game.playAgain }).click()
      await ann.page.getByRole('button', { name: ann.t.lobby.start }).click()
      await expect(session.outcome).toHaveCount(0)
    })

    await test.step('round 2: the killer’s player reloads mid-game, then the killer gets the inspector', async () => {
      const { killer, inspector } = await sides(session)
      const k = await killer.identity()
      let i: number | undefined
      await session.playRound(
        async (player) => {
          const prompt = await player.prompt()
          if (player === killer) {
            // The killer hunts: slide the inspector next to them, then kill them.
            if (prompt === player.t.duel.yourPrompt.opening_kill) return player.firstKill()
            i ??= await inspector.identity()
            const grid = await player.grid()
            if (distance(grid, k, i) <= 1) return player.strike('kill', i)
            return player.shift(closingShift(grid, k, i, await player.shifts(grid)))
          }
          if (await player.picking()) {
            i = await player.pick('choose_identity')
            return
          }
          // The inspector shifts lines that move neither of them.
          i ??= await player.identity()
          const grid = await player.grid()
          return player.shift(quietShift(grid, [k, i], await player.shifts(grid)))
        },
        async (moves) => {
          if (moves !== 2) return
          // Once the inspector has chosen, the killer's player reloads just before their turn. It must come
          // back on the same game and side, and make the next move.
          await killer.page.reload()
          const role = killer.page.locator('.dossier__role')
          await expect(role).toHaveText(killer.t.duel.youAre.killer)
          await expect.poll(() => killer.canAct()).toBe(true)
        },
      )
      await expectVerdict(session, killer, 'inspector_eliminated')
      await expectTvKeepsSecrets(session)
    })

    await session.expectNoErrors()
  } finally {
    await session.close()
  }
})
