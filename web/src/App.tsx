import { ConnectionCheck } from './components/ConnectionCheck'

export default function App() {
  return (
    <main className="case-file">
      <p className="case-file__eyebrow">Case file · Precinct 13</p>
      <h1 className="case-file__title">Precinct Noir</h1>
      <p className="case-file__lede">
        A hidden-identity deduction game for one big screen and a room full of phones.
      </p>
      <ConnectionCheck />
      <p className="case-file__note">The precinct opens soon.</p>
    </main>
  )
}
