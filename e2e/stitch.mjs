// Puts the TV and both phones side by side in one video, videos/session.mp4, from the recordings the test
// saves in videos/. Needs ffmpeg on the PATH.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const dir = new URL('./videos/', import.meta.url).pathname
const parts = ['tv.webm', 'phone-1.webm', 'phone-2.webm'].map((name) => dir + name)
const missing = parts.filter((path) => !existsSync(path))
if (missing.length > 0) {
  console.error(`No recording at ${missing.join(', ')}. Run the tests first.`)
  process.exit(1)
}
const out = dir + 'session.mp4'
const run = spawnSync(
  'ffmpeg',
  [
    ['-y', '-loglevel', 'error'],
    parts.flatMap((path) => ['-i', path]),
    [
      '-filter_complex',
      '[0:v]scale=-2:720,setsar=1[tv];[1:v]scale=-2:720,setsar=1[a];[2:v]scale=-2:720,setsar=1[b];' +
        '[tv][a][b]hstack=inputs=3,pad=ceil(iw/2)*2:ceil(ih/2)*2[v]',
    ],
    [
      '-map',
      '[v]',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '26',
      '-preset',
      'veryfast',
      out,
    ],
  ].flat(),
  { stdio: 'inherit' },
)
if (run.error || run.status !== 0) {
  console.error(run.error ? `ffmpeg didn't run: ${run.error.message}` : 'ffmpeg failed')
  process.exit(1)
}
console.log(`Wrote ${out}`)
