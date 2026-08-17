import { Routes, Route } from 'react-router'
import { useEffect, useState } from 'react'
import {
  AppShell,
  NavHeader,
  ScreenHeader,
  SectionHeader,
  SettingsGroup,
  Card,
  Input,
  Button,
  ListItem,
  Badge,
  StatusDot,
  Progress,
  SegmentedControl,
} from 'even-toolkit/web'
import { AppGlasses } from './glass/AppGlasses'
import { loadOuraConfig, saveOuraConfig, clearOuraConfig, testOuraConnection } from './lib/oura'
import { useOuraData } from './lib/useOuraData'
import { loadUnitSystem, saveUnitSystem, formatHoursMinutes, formatDistance, formatTempDeviation, type UnitSystem } from './lib/units'

function scoreLabel(score: number | null): string {
  return score === null ? '–' : `${score}`
}

const MINUTE_FIELDS = new Set([
  'totalSleepMinutes',
  'remSleepMinutes',
  'deepSleepMinutes',
  'lightSleepMinutes',
  'awakeMinutes',
  'highActivityMinutes',
  'mediumActivityMinutes',
  'lowActivityMinutes',
  'sedentaryMinutes',
  'restingMinutes',
])

const READINESS_LABELS: Record<string, { label: string; unit?: string }> = {
  restingHeartRate: { label: 'Resting Heart Rate', unit: ' bpm' },
  averageHrv: { label: 'Average HRV', unit: ' ms' },
  bodyTemperatureDeviation: { label: 'Body Temp Deviation' },
  hrvBalanceScore: { label: 'HRV Balance Score' },
  recoveryIndexScore: { label: 'Recovery Index Score' },
  sleepBalanceScore: { label: 'Sleep Balance Score' },
  activityBalanceScore: { label: 'Activity Balance Score' },
  previousDayActivityScore: { label: 'Previous Day Activity Score' },
  previousNightScore: { label: 'Previous Night Score' },
}

const SLEEP_LABELS: Record<string, { label: string; unit?: string }> = {
  totalSleepMinutes: { label: 'Total Sleep' },
  efficiencyPercent: { label: 'Efficiency', unit: '%' },
  remSleepMinutes: { label: 'REM Sleep' },
  deepSleepMinutes: { label: 'Deep Sleep' },
  lightSleepMinutes: { label: 'Light Sleep' },
  awakeMinutes: { label: 'Awake' },
  latencyMinutes: { label: 'Latency', unit: ' min' },
  timingScore: { label: 'Timing Score' },
  restlessPeriods: { label: 'Restless Periods' },
}

const ACTIVITY_LABELS: Record<string, { label: string; unit?: string }> = {
  highActivityMinutes: { label: 'High Activity' },
  mediumActivityMinutes: { label: 'Medium Activity' },
  lowActivityMinutes: { label: 'Low Activity' },
  sedentaryMinutes: { label: 'Sedentary' },
  restingMinutes: { label: 'Resting' },
  equivalentWalkingDistanceMeters: { label: 'Equiv. Walking Distance' },
  meetDailyTargetsScore: { label: 'Meet Daily Targets Score' },
  moveEveryHourScore: { label: 'Move Every Hour Score' },
  recoveryTimeScore: { label: 'Recovery Time Score' },
  stayActiveScore: { label: 'Stay Active Score' },
  trainingFrequencyScore: { label: 'Training Frequency Score' },
  trainingVolumeScore: { label: 'Training Volume Score' },
}

const DETAIL_LABELS: Record<MetricKey, Record<string, { label: string; unit?: string }>> = {
  readiness: READINESS_LABELS,
  sleep: SLEEP_LABELS,
  activity: ACTIVITY_LABELS,
}

const DISTANCE_FIELDS = new Set(['equivalentWalkingDistanceMeters'])
const TEMP_FIELDS = new Set(['bodyTemperatureDeviation'])

function formatDetailValue(key: string, value: number | null, units: UnitSystem): string {
  if (value === null) return '–'
  if (MINUTE_FIELDS.has(key)) return formatHoursMinutes(value)
  if (DISTANCE_FIELDS.has(key)) return formatDistance(value, units)
  if (TEMP_FIELDS.has(key)) return formatTempDeviation(value, units)
  return `${value}`
}

type MetricKey = 'readiness' | 'sleep' | 'activity'

function Home() {
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [expanded, setExpanded] = useState<MetricKey | null>(null)
  const [units, setUnits] = useState<UnitSystem>('metric')
  const oura = useOuraData()

  useEffect(() => {
    const config = loadOuraConfig()
    if (config) {
      setToken(config.token)
    }
    setUnits(loadUnitSystem())
  }, [])

  function handleUnitsChange(value: string) {
    const next = value === 'imperial' ? 'imperial' : 'metric'
    setUnits(next)
    saveUnitSystem(next)
  }

  async function handleSave() {
    if (!token) {
      setStatus({ ok: false, message: 'Enter your Oura personal access token first.' })
      return
    }
    saveOuraConfig({ token })
    setStatus({ ok: true, message: 'Saved. Testing connection…' })
    setTesting(true)
    const result = await testOuraConnection(token)
    setTesting(false)
    setStatus(result)
  }

  function handleClear() {
    clearOuraConfig()
    setToken('')
    setStatus({ ok: false, message: 'Cleared saved token.' })
  }

  const detailFor: Record<MetricKey, Record<string, number | null> | null> = {
    readiness: oura.readinessDetail as unknown as Record<string, number | null> | null,
    sleep: oura.sleepDetail as unknown as Record<string, number | null> | null,
    activity: oura.activityDetail as unknown as Record<string, number | null> | null,
  }

  const activityDetail = oura.activityDetail
  const calorieGoalPct =
    activityDetail?.targetCalories && oura.activeCalories !== null
      ? Math.min(100, Math.round((oura.activeCalories / activityDetail.targetCalories) * 100))
      : null
  const distanceGoalPct =
    activityDetail?.targetMeters && activityDetail.metersToTarget !== null
      ? Math.min(
          100,
          Math.round(
            ((activityDetail.targetMeters - activityDetail.metersToTarget) / activityDetail.targetMeters) * 100,
          ),
        )
      : null
  const distanceDoneMeters =
    activityDetail?.targetMeters && activityDetail.metersToTarget !== null
      ? activityDetail.targetMeters - activityDetail.metersToTarget
      : null

  return (
    <AppShell header={<NavHeader title="Oura" />}>
      <div className="px-3 pt-2 pb-8 space-y-6">
        <ScreenHeader
          title="Oura Ring"
          subtitle="Activity, Sleep & Readiness on your glasses"
          actions={<StatusDot connected={oura.connected} />}
        />

        {oura.connected && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'activity' as MetricKey, label: 'Activity', value: scoreLabel(oura.activityScore) },
                { key: 'sleep' as MetricKey, label: 'Sleep', value: scoreLabel(oura.sleepScore) },
                { key: 'readiness' as MetricKey, label: 'Readiness', value: scoreLabel(oura.readinessScore) },
              ]).map((stat) => (
                <button
                  key={stat.key}
                  type="button"
                  onClick={() => setExpanded((prev) => (prev === stat.key ? null : stat.key))}
                  className={`rounded-[var(--radius-default)] border px-3 py-3 text-center transition-colors ${
                    expanded === stat.key
                      ? 'border-accent bg-accent-alpha'
                      : 'border-border bg-surface'
                  }`}
                >
                  <div className="text-[22px] font-semibold tracking-[-0.4px] text-text">{stat.value}</div>
                  <div className="text-[12px] tracking-[-0.1px] text-text-dim">{stat.label}</div>
                </button>
              ))}
            </div>

            {expanded && (
              <Card padding="sm" className="space-y-2">
                {expanded === 'activity' && (calorieGoalPct !== null || distanceGoalPct !== null) && (
                  <div className="space-y-2 pb-1">
                    {calorieGoalPct !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[13px] tracking-[-0.13px]">
                          <span className="text-text-dim">Active Calories Goal</span>
                          <span className="text-text">
                            {oura.activeCalories}/{activityDetail?.targetCalories} kcal
                          </span>
                        </div>
                        <Progress value={calorieGoalPct} />
                      </div>
                    )}
                    {distanceGoalPct !== null && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[13px] tracking-[-0.13px]">
                          <span className="text-text-dim">Distance Goal</span>
                          <span className="text-text">
                            {formatDistance(distanceDoneMeters, units)}/{formatDistance(activityDetail!.targetMeters!, units)}
                          </span>
                        </div>
                        <Progress value={distanceGoalPct} />
                      </div>
                    )}
                  </div>
                )}
                {Object.entries(detailFor[expanded] ?? {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-[13px] tracking-[-0.13px]">
                    <span className="text-text-dim">{DETAIL_LABELS[expanded][key]?.label ?? key}</span>
                    <span className="text-text">
                      {formatDetailValue(key, value, units)}
                      {value !== null && !MINUTE_FIELDS.has(key) && !DISTANCE_FIELDS.has(key) && !TEMP_FIELDS.has(key)
                        ? DETAIL_LABELS[expanded][key]?.unit ?? ''
                        : ''}
                    </span>
                  </div>
                ))}
                {!detailFor[expanded] && (
                  <p className="text-[13px] tracking-[-0.13px] text-text-dim">No detail data yet.</p>
                )}
              </Card>
            )}
          </>
        )}


        <SettingsGroup label="CONNECTION">
          <Card padding="sm" className="space-y-3">
            <Input
              type="password"
              placeholder="Personal access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="highlight" size="sm" className="flex-1" onClick={handleSave} disabled={testing}>
                {testing ? 'Testing…' : 'Save & Test'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClear}>
                Clear
              </Button>
            </div>
            {status && (
              <Badge variant={status.ok ? 'positive' : 'negative'}>{status.message}</Badge>
            )}
          </Card>
        </SettingsGroup>

        <SettingsGroup label="UNITS">
          <Card padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-[13px] tracking-[-0.13px] text-text-dim">Distance & Temperature</span>
              <SegmentedControl
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
                value={units}
                onValueChange={handleUnitsChange}
                size="small"
              />
            </div>
          </Card>
        </SettingsGroup>

        <SettingsGroup label="TRACKED DATA">
          <ListItem title="Activity Score" subtitle="Daily activity · tap on glasses for contributors" />
          <ListItem title="Sleep Score" subtitle="Daily sleep · tap on glasses for contributors" />
          <ListItem title="Readiness Score" subtitle="Daily readiness · tap on glasses for contributors" />
          <ListItem title="Resilience" subtitle="Contributor level (limited/adequate/solid/strong/exceptional)" />
          <ListItem title="Active & Total Calories" subtitle="From daily activity" />
          <ListItem title="Steps" subtitle="From daily activity" />
        </SettingsGroup>

        <SectionHeader title="How to get a token" />
        <Card padding="default" className="space-y-1">
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">1. Go to cloud.ouraring.com and sign in.</p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">2. Open Personal Access Tokens in account settings.</p>
          <p className="text-[13px] tracking-[-0.13px] text-text-dim">3. Create a new token and paste it above.</p>
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

