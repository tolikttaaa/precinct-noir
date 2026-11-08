import { expect, test } from '@playwright/test'
import { closes, closingShift, collapsePlan, distance, quietShift } from '../support/grid'
import type { Phone } from '../support/phone'
import { Session } from '../support/session'
import { fill } from '../support/texts'

type Reason = 'inspector_eliminated' | 'kill_quota' | 'killer_caught'

/** Who plays which side this round, read from each phone's file. */
async function sides(session: Session): Promise<{ killer: Phone; inspector: Phone }> {
  for (const phone of session.phones)
    await expect(phone.page.locator('.dossier__role')).toBeVisible()
  const [a, b] = session.phones
  return (await a.role()) === 'killer' ? { killer: a, inspector: b } : { killer: b, inspector: a }
}

async function expectVerdict(session: Session, winner: Phone, reason: Reason): Promise<void> {
  const tv = session.phones[0].t
  await expect(session.outcome).toContainText(fill(tv.duel.over.winner, { name: winner.name }))
  await expect(session.outcome).toContainText(fill(tv.duel.over.reason[reason], { max: 14 }))
  for (const phone of session.phones) {
    const verdict = phone.page.locator('.outcome')
    await expect(verdict).toContainText(fill(phone.t.duel.over.winner, { name: winner.name }))
  }
}

/** Secrets belong on phones only: the TV never shows a file or marks anyone's own card. */
async function expectTvKeepsSecrets(session: Session): Promise<void> {
  await expect(session.tv.locator('.dossier, [data-mine]')).toHaveCount(0)
}

test('a living-room session: a TV and two phones play two rounds of Shadow Duel', async ({
  browser,
}) => {
  const session = await Session.open(browser, [
    ['Ann', 'en'],
    ['Борис', 'ru'],
  ])
  const [ann, boris] = session.phones
  try {
    await test.step('the TV opens a room, and two phones join it, one in Russian', async () => {
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
      await session.playRound(async (phone) => {
        const prompt = await phone.prompt()
        if (phone === killer) {
          if (prompt === phone.t.duel.yourPrompt.opening_kill) return phone.firstKill()
          if (prompt === phone.t.duel.yourPrompt.collapse_more) return phone.stopCollapsing()
          i ??= await inspector.identity()
          const grid = await phone.grid()
          if (!collapsed) {
            // The killer works towards closing the city up, sparing the inspector, and collapses it as soon
            // as every row or every column has a body. Until then, the tab says why it can't.
            expect(await phone.available('collapse')).toBe(closes(grid))
            if (closes(grid)) {
              collapsed = true
              await phone.collapse()
              return expect(session.tv.locator('.board__cell')).toHaveCount(
                grid.rows * grid.cols - 5,
              )
            }
            expect(await phone.explanation('collapse')).toBe(phone.t.duel.unavailable.collapse)
            const step = collapsePlan(grid, k, [i], await phone.shifts(grid))
            if (step && 'kill' in step) return phone.strike('kill', step.kill)
            if (step) return phone.shift(step.shift)
          }
          // Otherwise it slides lines that move neither of them.
          return phone.shift(quietShift(grid, [k, i], await phone.shifts(grid)))
        }
        if (await phone.picking()) {
          if (prompt === phone.t.duel.yourPrompt.exonerate_discard)
            return void (await phone.pick('exonerate_discard'))
          i = await phone.pick('choose_identity')
          return
        }
        if (!cleared) {
          // The accuse tab lights who could be accused; switching to clearing a suspect needs no cancel.
          cleared = true
          expect((await phone.targets('accuse')).length).toBeGreaterThan(0)
          return phone.clearSuspect()
        }
        // The inspector waits out the collapse, then slides the killer next to them and accuses.
        i ??= await phone.identity()
        const grid = await phone.grid()
        if (!collapsed) return phone.shift(quietShift(grid, [k, i], await phone.shifts(grid)))
        if (distance(grid, k, i) <= 1) return phone.strike('accuse', k)
        return phone.shift(closingShift(grid, k, i, await phone.shifts(grid)))
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

    await test.step('round 2: the killer’s phone reloads mid-game, then the killer gets the inspector', async () => {
      const { killer, inspector } = await sides(session)
      const k = await killer.identity()
      let i: number | undefined
      await session.playRound(
        async (phone) => {
          const prompt = await phone.prompt()
          if (phone === killer) {
            // The killer hunts: slide the inspector next to them, then kill them.
            if (prompt === phone.t.duel.yourPrompt.opening_kill) return phone.firstKill()
            i ??= await inspector.identity()
            const grid = await phone.grid()
            if (distance(grid, k, i) <= 1) return phone.strike('kill', i)
            return phone.shift(closingShift(grid, k, i, await phone.shifts(grid)))
          }
          if (await phone.picking()) {
            i = await phone.pick('choose_identity')
            return
          }
          // The inspector shifts lines that move neither of them.
          i ??= await phone.identity()
          const grid = await phone.grid()
          return phone.shift(quietShift(grid, [k, i], await phone.shifts(grid)))
        },
        async (moves) => {
          if (moves !== 2) return
          // Once the inspector has chosen, the killer's phone reloads just before their turn. It must come
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
