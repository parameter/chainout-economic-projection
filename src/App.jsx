import { useEffect, useMemo, useState } from 'react'
import './App.css'

function formatNumber(value) {
  const rounded = Math.round(Number(value) || 0)
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

function formatCurrency(value) {
  return `${formatNumber(value)} SEK`
}

const initialInputs = {
  months: 24,
  initialUsers: 12000,
  monthlyNewUsers: 1800,
  monthlyUserGrowthRate: 3,
  freeUserShare: 88,
  monthlyFreeToPaidRate: 2.3,
  monthlyPaidChurnRate: 4.2,
  monthlyFreeChurnRate: 2.1,
  subscriptionPrice: 14,
  sponsorChallengesPerMonth: 3,
  sponsorFeePerChallenge: 8500,
  challengeCostPerMonth: 7000,
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''

function clampPercent(value) {
  return Math.max(0, Math.min(100, value))
}

function normalizeInputs(rawInputs) {
  const normalized = { ...initialInputs }

  Object.keys(initialInputs).forEach((key) => {
    const parsedValue = Number(rawInputs?.[key])
    normalized[key] = Number.isFinite(parsedValue) ? parsedValue : initialInputs[key]
  })

  return normalized
}

function App() {
  const [inputs, setInputs] = useState(initialInputs)
  const [projectionName, setProjectionName] = useState('')
  const [savedProjections, setSavedProjections] = useState([])
  const [selectedProjectionId, setSelectedProjectionId] = useState('')
  const [saveStatus, setSaveStatus] = useState('')
  const [loadStatus, setLoadStatus] = useState('')

  const projection = useMemo(() => {
    const months = Math.max(1, Number(inputs.months) || 1)
    const freeShare = clampPercent(Number(inputs.freeUserShare) || 0) / 100
    const paidShare = 1 - freeShare
    const freeToPaidRate = clampPercent(Number(inputs.monthlyFreeToPaidRate) || 0) / 100
    const paidChurnRate = clampPercent(Number(inputs.monthlyPaidChurnRate) || 0) / 100
    const freeChurnRate = clampPercent(Number(inputs.monthlyFreeChurnRate) || 0) / 100
    const growthRate = clampPercent(Number(inputs.monthlyUserGrowthRate) || 0) / 100

    let freeUsers = Math.max(0, (Number(inputs.initialUsers) || 0) * freeShare)
    let paidUsers = Math.max(0, (Number(inputs.initialUsers) || 0) * paidShare)

    const rows = []
    let cumulativeRevenue = 0

    for (let month = 1; month <= months; month += 1) {
      const baseNewUsers = Number(inputs.monthlyNewUsers) || 0
      const growthMultiplier = Math.pow(1 + growthRate, month - 1)
      const newUsers = baseNewUsers * growthMultiplier
      const newFreeUsers = newUsers * freeShare
      const newPaidUsers = newUsers * paidShare

      freeUsers += newFreeUsers
      paidUsers += newPaidUsers

      const upgrades = freeUsers * freeToPaidRate
      freeUsers -= upgrades
      paidUsers += upgrades

      const paidChurn = paidUsers * paidChurnRate
      const freeChurn = freeUsers * freeChurnRate
      paidUsers -= paidChurn
      freeUsers -= freeChurn

      const subscriptionRevenue = paidUsers * (Number(inputs.subscriptionPrice) || 0)
      const sponsorRevenue =
        (Number(inputs.sponsorChallengesPerMonth) || 0) *
        (Number(inputs.sponsorFeePerChallenge) || 0)
      const challengeCost = Number(inputs.challengeCostPerMonth) || 0
      const netRevenue = subscriptionRevenue + sponsorRevenue - challengeCost
      cumulativeRevenue += netRevenue

      rows.push({
        month,
        freeUsers,
        paidUsers,
        totalUsers: freeUsers + paidUsers,
        subscriptionRevenue,
        sponsorRevenue,
        challengeCost,
        netRevenue,
        cumulativeRevenue,
      })
    }

    return rows
  }, [inputs])

  const totals = useMemo(() => {
    const lastMonth = projection.at(-1)
    const recurringSponsorRevenue =
      (Number(inputs.sponsorChallengesPerMonth) || 0) *
      (Number(inputs.sponsorFeePerChallenge) || 0)

    return {
      finalUsers: lastMonth?.totalUsers || 0,
      finalPaidUsers: lastMonth?.paidUsers || 0,
      monthlyRunRate: lastMonth?.netRevenue || 0,
      sponsorMonthly: recurringSponsorRevenue,
      cumulativeRevenue: lastMonth?.cumulativeRevenue || 0,
    }
  }, [inputs.sponsorChallengesPerMonth, inputs.sponsorFeePerChallenge, projection])

  const updateInput = (key) => (event) => {
    setInputs((current) => ({
      ...current,
      [key]: Number(event.target.value),
    }))
  }

  useEffect(() => {
    async function fetchProjectionList() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/projections`)
        if (!response.ok) {
          throw new Error('Could not fetch projections')
        }

        const data = await response.json()
        setSavedProjections(Array.isArray(data) ? data : [])
      } catch {
        setLoadStatus('Could not connect to projection API.')
      }
    }

    fetchProjectionList()
  }, [])

  const saveProjection = async () => {
    const trimmedName = projectionName.trim()
    if (!trimmedName) {
      setSaveStatus('Enter a projection name first.')
      return
    }

    setSaveStatus('Saving...')

    try {
      const response = await fetch(`${apiBaseUrl}/api/projections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          inputs,
        }),
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      setSaveStatus('Projection saved.')
      setProjectionName('')

      const refreshed = await fetch(`${apiBaseUrl}/api/projections`)
      const refreshedData = await refreshed.json()
      setSavedProjections(Array.isArray(refreshedData) ? refreshedData : [])
    } catch {
      setSaveStatus('Save failed. Check API and MongoDB connection.')
    }
  }

  const loadProjection = async () => {
    if (!selectedProjectionId) {
      setLoadStatus('Select a saved projection.')
      return
    }

    setLoadStatus('Loading...')

    try {
      const response = await fetch(`${apiBaseUrl}/api/projections/${selectedProjectionId}`)
      if (!response.ok) {
        throw new Error('Load failed')
      }

      const doc = await response.json()
      setInputs(normalizeInputs(doc.inputs))
      setLoadStatus(`Loaded "${doc.name}".`)
    } catch {
      setLoadStatus('Load failed. Try again.')
    }
  }

  return (
    <main className="app-shell">
      <section className="header">
        <h1>Subscription Projection Studio</h1>
        <p>
          Tune freemium and sponsor assumptions, then track users and revenue
          month by month.
        </p>
      </section>

      <section className="kpi-grid">
        <article>
          <h2>Users at End</h2>
          <p>{formatNumber(totals.finalUsers)}</p>
        </article>
        <article>
          <h2>Paid Users at End</h2>
          <p>{formatNumber(totals.finalPaidUsers)}</p>
        </article>
        <article>
          <h2>Monthly Net Run Rate</h2>
          <p>{formatCurrency(totals.monthlyRunRate)}</p>
        </article>
        <article>
          <h2>Sponsor Monthly Revenue</h2>
          <p>{formatCurrency(totals.sponsorMonthly)}</p>
        </article>
        <article>
          <h2>Cumulative Net Revenue</h2>
          <p>{formatCurrency(totals.cumulativeRevenue)}</p>
        </article>
      </section>

      <section className="content">
        <aside className="controls">
          <h2>Assumptions</h2>

          <div className="persistence">
            <label>
              Projection name
              <input
                type="text"
                value={projectionName}
                onChange={(event) => setProjectionName(event.target.value)}
                placeholder="Q3 sponsor push"
              />
            </label>
            <button type="button" onClick={saveProjection}>
              Save projection
            </button>
            {saveStatus ? <p className="status-text">{saveStatus}</p> : null}
            <label>
              Saved projections
              <select
                value={selectedProjectionId}
                onChange={(event) => setSelectedProjectionId(event.target.value)}
              >
                <option value="">Select a projection</option>
                {savedProjections.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={loadProjection}>
              Load projection
            </button>
            {loadStatus ? <p className="status-text">{loadStatus}</p> : null}
          </div>

          <label>
            Projection months
            <input type="number" min="1" value={inputs.months} onChange={updateInput('months')} />
          </label>
          <label>
            Initial users
            <input
              type="number"
              min="0"
              value={inputs.initialUsers}
              onChange={updateInput('initialUsers')}
            />
          </label>
          <label>
            New users / month
            <input
              type="number"
              min="0"
              value={inputs.monthlyNewUsers}
              onChange={updateInput('monthlyNewUsers')}
            />
          </label>
          <label>
            New user growth % / month
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputs.monthlyUserGrowthRate}
              onChange={updateInput('monthlyUserGrowthRate')}
            />
          </label>
          <label>
            Free user share %
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputs.freeUserShare}
              onChange={updateInput('freeUserShare')}
            />
          </label>
          <label>
            Free -&gt; paid conversion % / month
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputs.monthlyFreeToPaidRate}
              onChange={updateInput('monthlyFreeToPaidRate')}
            />
          </label>
          <label>
            Paid churn % / month
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputs.monthlyPaidChurnRate}
              onChange={updateInput('monthlyPaidChurnRate')}
            />
          </label>
          <label>
            Free churn % / month
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={inputs.monthlyFreeChurnRate}
              onChange={updateInput('monthlyFreeChurnRate')}
            />
          </label>
          <label>
            Subscription price (SEK)
            <input
              type="number"
              min="0"
              step="0.5"
              value={inputs.subscriptionPrice}
              onChange={updateInput('subscriptionPrice')}
            />
          </label>
          <label>
            Sponsor challenges / month
            <input
              type="number"
              min="0"
              value={inputs.sponsorChallengesPerMonth}
              onChange={updateInput('sponsorChallengesPerMonth')}
            />
          </label>
          <label>
            Sponsor fee / challenge (SEK)
            <input
              type="number"
              min="0"
              value={inputs.sponsorFeePerChallenge}
              onChange={updateInput('sponsorFeePerChallenge')}
            />
          </label>
          <label>
            Challenge costs / month (SEK)
            <input
              type="number"
              min="0"
              value={inputs.challengeCostPerMonth}
              onChange={updateInput('challengeCostPerMonth')}
            />
          </label>
        </aside>

        <section className="results">
          <h2>Monthly Projection</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Users</th>
                  <th>Paid Users</th>
                  <th>Subscription Rev</th>
                  <th>Sponsor Rev</th>
                  <th>Challenge Cost</th>
                  <th>Net Revenue</th>
                  <th>Cumulative Net</th>
                </tr>
              </thead>
              <tbody>
                {projection.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td>{formatNumber(row.totalUsers)}</td>
                    <td>{formatNumber(row.paidUsers)}</td>
                    <td>{formatCurrency(row.subscriptionRevenue)}</td>
                    <td>{formatCurrency(row.sponsorRevenue)}</td>
                    <td>{formatCurrency(row.challengeCost)}</td>
                    <td>{formatCurrency(row.netRevenue)}</td>
                    <td>{formatCurrency(row.cumulativeRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
