import { useEffect, useState } from 'react'

export default function App(): React.JSX.Element {
  const [result, setResult] = useState('')
  useEffect(() => {
    window.api.ping().then(setResult)
  }, [])
  return (
    <main className="min-h-screen bg-slate-900 p-8 text-slate-100">
      <h1 className="text-2xl font-semibold">My PhD OS smoke</h1>
      <p id="result" data-testid="result">
        {result}
      </p>
    </main>
  )
}
