import { Routes, Route } from 'react-router'
import { useEffect, useState } from 'react'
import { AppShell, NavHeader, ScreenHeader, Card, Button, SectionHeader, ListItem } from 'even-toolkit/web'
import { AppGlasses } from './glass/AppGlasses'
import { loadOuraConfig, saveOuraConfig, clearOuraConfig, testOuraConnection } from './lib/oura'

function Home() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    const config = loadOuraConfig()
    if (config) {
      setToken(config.token)
    }
  }, [])

  async function handleSave() {
    if (!token) {
      setStatus('Enter your Oura personal access token first.')
      return
    }
    saveOuraConfig({ token })
    setStatus('Saved. Testing connection…')
    setTesting(true)
    const result = await testOuraConnection(token)
    setTesting(false)
    setStatus(result.message)
  }

  function handleClear() {
    clearOuraConfig()
    setToken('')
    setStatus('Cleared saved token.')
  }

  return (
    <AppShell header={<NavHeader title="Oura Glance G2" />}>
      <div className="px-3 pt-4 pb-8 space-y-3">
        <ScreenHeader
          title="Oura Ring on your glasses"
          subtitle="Readiness, Activity, Resilience & calories at a glance"
        />

        <Card>
          <div className="p-3 space-y-2">
            <label className="text-sm font-medium">Oura Personal Access Token</label>
            <input
              type="password"
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Generate at cloud.ouraring.com/personal-access-tokens"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <Button variant="highlight" size="sm" onClick={handleSave} disabled={testing}>
                {testing ? 'Testing…' : 'Save & Test'}
              </Button>
              <Button variant="default" size="sm" onClick={handleClear}>
                Clear
              </Button>
            </div>
            {status && <p className="text-xs text-gray-500 pt-1">{status}</p>}
          </div>
        </Card>

        <SectionHeader title="Tracked data" />
        <Card>
          <ListItem title="Readiness Score" subtitle="Daily readiness summary" />
          <ListItem title="Activity Score" subtitle="Daily activity summary" />
          <ListItem title="Resilience" subtitle="Contributor level (limited/adequate/solid/strong/exceptional)" />
          <ListItem title="Active & Total Calories" subtitle="From daily activity" />
          <ListItem title="Steps" subtitle="From daily activity" />
        </Card>

        <SectionHeader title="How to get a token" />
        <Card>
          <div className="p-3 space-y-1 text-sm text-gray-600">
            <p>1. Go to cloud.ouraring.com and sign in.</p>
            <p>2. Open Personal Access Tokens in account settings.</p>
            <p>3. Create a new token and paste it above.</p>
          </div>
        </Card>
      </div>
      <AppGlasses />
    </AppShell>
  )
}

export function App() {
  return (
    <Routes>
      <Route path="/*" element={<Home />} />
    </Routes>
  )
}
