// Puts the screens in one video, videos/session.mp4, from the frames the test records
// (videos/timeline.json). Needs ffmpeg on the PATH. The TV is on top, the players' screens side by side
// under it, with a line between each:
//
//   tv
//   --------------
//   laptop | phone
//
// Every frame carries the time it was painted, on one clock for all three screens. Each frame is shown
// from that moment until the screen's next frame, so all three screens stay in step, through still
// stretches and reloads alike. Before a screen's first frame it's dark.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('./videos/', import.meta.url).pathname
if (!existsSync(dir + 'timeline.json')) {
  console.error(`No recording in ${dir}. Run the tests first.`)
  process.exit(1)
}
const { start, end, screens } = JSON.parse(readFileSync(dir + 'timeline.json', 'utf8'))
const HEIGHT = 720 // of the players' row
const LINE = 6 // the dividers' thickness
const LINE_COLOR = '0xb8945a' // brass, as in the game
const FPS = 25
const total = Math.round(((end - start) / 1000) * FPS)
const even = (n) => Math.round(n / 2) * 2

function run(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' })
  if (result.error || result.status !== 0) {
    console.error(result.error ? `ffmpeg didn't run: ${result.error.message}` : result.stderr)
    process.exit(1)
  }
}

const inputs = screens.map((screen) => {
  const width = even((screen.size.width * HEIGHT) / screen.size.height) // in the players' row
  const dark = `${dir}${screen.name}-dark.jpg`
  const { width: w, height: h } = screen.size
  run(['-f', 'lavfi', '-i', `color=c=0x0b0f15:s=${w}x${h}`, '-frames:v', '1', dark])
  // An ffconcat list on a 25 fps grid: at each video frame, the latest picture painted by then. Working on
  // the grid keeps every duration a whole number of frames, so ffmpeg can't round the screens apart.
  const runs = []
  let next = 0
  for (let k = 0; k < total; k++) {
    const t = start + (k * 1000) / FPS
    while (next < screen.frames.length && screen.frames[next].at <= t) next++
    const file = next === 0 ? dark : screen.frames[next - 1].file
    if (runs.length > 0 && runs[runs.length - 1].file === file) runs[runs.length - 1].count++
    else runs.push({ file, count: 1 })
  }
  const lines = ['ffconcat version 1.0']
  for (const run of runs)
    lines.push(`file '${run.file}'`, `duration ${(run.count / FPS).toFixed(6)}`)
  // ffmpeg ignores the last duration unless the last picture is listed once more.
  lines.push(`file '${runs[runs.length - 1].file}'`)
  const list = `${dir}${screen.name}.ffconcat`
  writeFileSync(list, lines.join('\n') + '\n')
  return { list, width }
})

const out = dir + 'session.mp4'
const players = inputs.slice(1)
const width = players.reduce((sum, p) => sum + p.width, 0) + LINE * (players.length - 1)
const tvHeight = even((width * screens[0].size.height) / screens[0].size.width)
const line = (w, h, name) => `color=c=${LINE_COLOR}:s=${w}x${h}:r=${FPS},format=yuv420p[${name}]`
const fit = (i, w, h) => `[${i}:v]scale=${w}:${h},setsar=1,fps=${FPS},format=yuv420p[v${i}]`
const row = players.flatMap((_, i) => (i === 0 ? [`[v${i + 1}]`] : [`[l${i}]`, `[v${i + 1}]`]))
const graph = [
  fit(0, width, tvHeight),
  ...players.map((p, i) => fit(i + 1, p.width, HEIGHT)),
  ...players.slice(1).map((_, i) => line(LINE, HEIGHT, `l${i + 1}`)),
  `${row.join('')}hstack=inputs=${row.length}[row]`,
  line(width, LINE, 'top'),
  `[v0][top][row]vstack=inputs=3[v]`,
].join(';')
run([
  // A stray frame of another size (the first paint can be) mustn't make ffmpeg rebuild the filters, which
  // would drop time from that screen; the scale filter copes with it instead.
  ...inputs.flatMap(({ list }) => [
    '-reinit_filter',
    '0',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
  ]),
  '-filter_complex',
  graph,
  ...['-map', '[v]', '-c:v', 'libx264', '-crf', '26', '-preset', 'veryfast'],
  ...['-frames:v', String(total), out],
])
const counts = screens.map((s) => `${s.name} ${s.frames.length}`).join(', ')
console.log(`${((end - start) / 1000).toFixed(1)} s, frames: ${counts}. Wrote ${out}`)
