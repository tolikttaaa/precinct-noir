import { EvidenceWall } from './components/EvidenceWall'
import { parseRoute, usePath } from './routing'
import { Home } from './screens/Home'
import { Missing } from './screens/Missing'
import { PlayerScreen } from './screens/PlayerScreen'
import { TvScreen } from './screens/TvScreen'

export default function App() {
  const route = parseRoute(usePath())
  return (
    <>
      <EvidenceWall dim={route.page === 'player' || route.page === 'missing'} />
      <Screen route={route} />
    </>
  )
}

function Screen({ route }: { route: ReturnType<typeof parseRoute> }) {
  switch (route.page) {
    case 'home':
      return <Home />
    case 'tv':
      return <TvScreen key={`tv/${route.code}`} code={route.code} />
    case 'player':
      return <PlayerScreen key={route.code} code={route.code} />
    case 'missing':
      return <Missing />
  }
}
