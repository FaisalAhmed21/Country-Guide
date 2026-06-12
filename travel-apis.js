// travel-apis.js — Claude AI-powered travel guide engine
// Factual data: geocoded.me / RestCountries / Open-Meteo / MealDB
// Rich travel content: Claude AI API (claude-sonnet-4-6)

const GEOCODED_BASE  = 'https://api.geocoded.me'
const MEALDB_API     = 'https://www.themealdb.com/api/json/v1/1'
const OPEN_METEO     = 'https://archive-api.open-meteo.com/v1/archive'
const RESTCOUNTRIES  = 'https://restcountries.com/v3.1/alpha'
const CLAUDE_API     = 'https://dawn-sound-a836.faisalahmedmahin21.workers.dev'
const CLAUDE_MODEL   = 'claude-haiku-4-5-20251001'

const CACHE_TTL_MS      = 6 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS  = 12000
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Utilities ────────────────────────────────────────────────────────────────

function normalizeKey(str) {
  return (str ?? '').toLowerCase().trim().replace(/\s+/g,' ')
}
function withTimeout(p, ms, fb) {
  return Promise.race([p, new Promise(r => setTimeout(() => r(fb), ms))])
}
async function getJSON(url) {
  const r = await fetch(url, { headers:{ Accept:'application/json' } })
  if (!r.ok) throw new Error(r.status)
  return r.json()
}

// ─── Cache ────────────────────────────────────────────────────────────────────

function cacheKey(id) { return `cg_v9_${String(id).toUpperCase()}` }
function getCachedGuide(id) {
  try {
    const raw = sessionStorage.getItem(cacheKey(id))
    if (!raw) return null
    const { savedAt, data } = JSON.parse(raw)
    if (Date.now() - savedAt > CACHE_TTL_MS) { sessionStorage.removeItem(cacheKey(id)); return null }
    return data
  } catch { return null }
}
function setCachedGuide(id, data) {
  try { sessionStorage.setItem(cacheKey(id), JSON.stringify({ savedAt: Date.now(), data })) } catch {}
}

// ─── Country facts (geocoded.me → RestCountries fallback) ────────────────────

async function fetchCountryFacts(identifier) {
  try {
    const r = await fetch(`${GEOCODED_BASE}/countries/${identifier}`)
    if (r.ok) return r.json()
  } catch {}
  const rc = await fetch(`${RESTCOUNTRIES}/${identifier}`)
  if (!rc.ok) throw new Error('Country not found')
  const [d] = await rc.json()
  const langs = Object.values(d.languages || {})
  const currencies = Object.entries(d.currencies || {})
  const [curCode, curInfo] = currencies[0] || []
  return {
    iso2: d.cca2,
    name: d.name.common,
    native: Object.values(d.name.nativeName || {})[0]?.common || d.name.common,
    capital: d.capital?.[0] || '',
    region: d.region || '',
    subregion: d.subregion || '',
    population: d.population || 0,
    languages: langs,
    currency: curCode || '',
    currencyName: curInfo?.name || '',
    phoneCode: (d.idd?.root || '').replace('+','') + (d.idd?.suffixes?.[0] || ''),
    drivingSide: d.car?.side || '',
    neighbours: d.borders || [],
    latitude: d.latlng?.[0] || 0,
    longitude: d.latlng?.[1] || 0,
    flagUrl: d.flags?.png || '',
    nationality: d.demonyms?.eng?.m || '',
  }
}

// ─── Claude AI content generation ────────────────────────────────────────────

async function askClaude(systemPrompt, userPrompt) {
  try {
    const res = await withTimeout(
      fetch(CLAUDE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      }),
      FETCH_TIMEOUT_MS, null
    )
    if (!res) { console.error('Claude: timed out'); return null }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('Claude API error:', res.status, JSON.stringify(err))
      return null
    }
    const data = await res.json()
    const text = (data.content || []).map(b => b.text || '').join('')
    return text.replace(/^```json\s*/i,'').replace(/```\s*$/,'').trim()
  } catch(e) { console.error('Claude fetch error:', e); return null }
}

async function fetchClaudeAttractions(country) {
  const system = `You are an expert travel writer. Always respond with valid JSON only — no markdown, no preamble, no trailing text.`
  const user = `Give me a rich travel guide for ${country.name} (${country.region}).

Return ONLY a JSON object with this exact structure:
{
  "mustSee": [
    { "name": "string", "description": "string (2-3 engaging sentences for a traveller)", "tag": "string (e.g. UNESCO, Historical, Nature, City)" }
  ],
  "thingsToDo": [
    { "name": "string", "description": "string (2-3 sentences on what to expect)", "tag": "string (e.g. Adventure, Culture, Nightlife)" }
  ],
  "localGems": [
    { "name": "string", "description": "string (2-3 sentences — off the beaten path)", "tag": "string" }
  ]
}

Rules:
- mustSee: 6–8 iconic sites every traveller should visit
- thingsToDo: 6–8 activities (mix of adventure, culture, food tours, nature)
- localGems: 4–6 hidden gems locals love
- Write like a knowledgeable friend, not an encyclopedia. Be specific, evocative, practical.
- No Wikipedia-style dry text. Mention what makes each place special FOR A TRAVELLER.`

  const raw = await askClaude(system, user)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function fetchClaudeFood(country) {
  const system = `You are an expert food travel writer. Always respond with valid JSON only — no markdown, no preamble.`
  const user = `Create a food guide for a traveller visiting ${country.name}.

Return ONLY a JSON object:
{
  "summary": "string (2-3 sentences about the food scene — exciting, not encyclopedic)",
  "dishes": [
    { "name": "string", "description": "string (what it is, how it tastes, where to find it)", "tag": "string (e.g. Street Food, National Dish, Dessert)", "mustTry": true }
  ],
  "eat": [
    { "name": "string (restaurant type or market name)", "description": "string (what to expect, what to order)", "tag": "string" }
  ],
  "drink": [
    { "name": "string", "description": "string (taste, occasion, where to drink it)", "tag": "string" }
  ]
}

Rules:
- dishes: 6–8 must-try dishes with vivid tasting notes
- eat: 4–6 types of places to eat (street markets, local joints, etc.)
- drink: 3–5 local drinks (alcoholic and non-alcoholic)
- Be specific, sensory, and practical. What does it taste like? Where do locals eat it?`

  const raw = await askClaude(system, user)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function fetchClaudeTransport(country) {
  const system = `You are a practical travel advisor. Always respond with valid JSON only — no markdown, no preamble.`
  const user = `Write a practical transport guide for travellers in ${country.name} (capital: ${country.capital || 'N/A'}, driving side: ${country.drivingSide || 'unknown'}).

Return ONLY a JSON object:
{
  "summary": "string (2-3 sentences — overall transport vibe, ease of getting around)",
  "bullets": ["string (practical tip)", "string", "string", "string"],
  "options": [
    { "type": "string (train|bus|rideshare|ferry|walking|other)", "name": "string", "description": "string (practical info — cost hints, app names, what to expect)", "availability": "string (excellent|good|limited)", "costHint": "string or null" }
  ]
}

Rules:
- bullets: 4–5 key tips (apps to use, safety, pricing norms, scams to avoid)
- options: 4–6 transport modes actually relevant to this country
- Be practical and specific: name real apps (Grab, Uber, etc.) where relevant. Give price ranges if possible.`

  const raw = await askClaude(system, user)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function fetchClaudeTips(country) {
  const system = `You are an expert travel safety and culture advisor. Always respond with valid JSON only — no markdown, no preamble.`
  const user = `Write practical travel tips for visiting ${country.name} (region: ${country.region}, languages: ${(country.languages||[]).join(', ')}).

Return ONLY a JSON object:
{
  "staySafe": {
    "summary": "string (main safety consideration in 1-2 sentences)",
    "details": ["string (specific tip)", "string", "string", "string", "string"]
  },
  "getIn": {
    "summary": "string (visa/entry situation in 1-2 sentences)",
    "details": ["string", "string", "string", "string"]
  },
  "dos": {
    "summary": "string (most important thing TO do)",
    "details": ["string (specific do)", "string", "string", "string", "string"]
  },
  "donts": {
    "summary": "string (most important thing NOT to do)",
    "details": ["string (specific don't)", "string", "string", "string", "string"]
  },
  "respect": {
    "summary": "string (key cultural etiquette point)",
    "details": ["string", "string", "string", "string"]
  }
}

Rules:
- Be specific to THIS country's actual culture, laws, and norms — not generic travel advice
- staySafe: real risks (petty crime, health, road safety, political areas)
- dos/donts: culturally specific, not obvious generic tips
- respect: genuine local customs (greetings, dress codes, religious norms, tipping)
- getIn: visa reality for most Western passport holders, what to expect at the border`

  const raw = await askClaude(system, user)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

async function fetchClaudeOverview(country) {
  const system = `You are a travel writer. Always respond with valid JSON only — no markdown, no preamble.`
  const user = `Write an overview for a travel guide to ${country.name}.

Return ONLY a JSON object:
{
  "understand": "string (3-4 sentences — what kind of country is this for a traveller? What's the vibe? What makes it unique? Conversational, not encyclopedic.)",
  "accommodationAreas": [
    { "name": "string (area/city name)", "vibe": "string (2 sentences on the feel and what's nearby)", "budget": "string (budget|mid|luxury|mixed)", "bestFor": "string (e.g. First-timers, Backpackers, Families, Nightlife seekers)", "notes": "string or empty" }
  ]
}

Rules:
- understand: hook the reader — what's the single best thing about visiting this country?
- accommodationAreas: 3–5 real areas/cities to base yourself, with honest vibes`

  const raw = await askClaude(system, user)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ─── MealDB (for dish photos) ─────────────────────────────────────────────────

const MEALDB_MAP = {
  'united states of america':'American','united states':'American','usa':'American',
  'united kingdom':'British','great britain':'British','england':'British',
  'canada':'Canadian','china':'Chinese',"people's republic of china":'Chinese',
  'croatia':'Croatian','denmark':'Danish','egypt':'Egyptian','france':'French',
  'greece':'Greek','india':'Indian','ireland':'Irish','italy':'Italian',
  'jamaica':'Jamaican','japan':'Japanese','kenya':'Kenyan','malaysia':'Malaysian',
  'mexico':'Mexican','morocco':'Moroccan','netherlands':'Dutch','nigeria':'Nigerian',
  'philippines':'Filipino','poland':'Polish','portugal':'Portuguese',
  'russia':'Russian','russian federation':'Russian','spain':'Spanish',
  'thailand':'Thai','trinidad and tobago':'Trinidadian','tunisia':'Tunisian',
  'turkey':'Turkish','türkiye':'Turkish','ukraine':'Ukrainian',
  'uruguay':'Uruguayan','vietnam':'Vietnamese','viet nam':'Vietnamese',
}
let _mealAreas = null

async function getMealAreas() {
  if (_mealAreas) return _mealAreas
  try {
    const d = await withTimeout(getJSON(`${MEALDB_API}/list.php?a=list`), FETCH_TIMEOUT_MS, null)
    _mealAreas = (d?.meals||[]).map(m => m.strArea).filter(Boolean)
  } catch { _mealAreas = [] }
  return _mealAreas
}

async function fetchMealDBImages(countryName) {
  const areas = await getMealAreas()
  const key = normalizeKey(countryName)
  const area = MEALDB_MAP[key]
    || areas.find(a => normalizeKey(a) === key)
    || areas.find(a => key.includes(normalizeKey(a)) || normalizeKey(a).includes(key))
  if (!area) return {}

  try {
    const d = await withTimeout(getJSON(`${MEALDB_API}/filter.php?a=${encodeURIComponent(area)}`), FETCH_TIMEOUT_MS, null)
    const meals = (d?.meals||[]).slice(0,12)
    const map = {}
    meals.forEach(m => { map[normalizeKey(m.strMeal)] = m.strMealThumb })
    return map
  } catch { return {} }
}

// ─── Climate (Open-Meteo) ─────────────────────────────────────────────────────

async function fetchClimate(lat, lon) {
  const year = new Date().getFullYear() - 1
  try {
    const d = await withTimeout(
      getJSON(`${OPEN_METEO}?latitude=${lat}&longitude=${lon}&start_date=${year}-01-01&end_date=${year}-12-31&daily=temperature_2m_mean,precipitation_sum&timezone=auto`),
      FETCH_TIMEOUT_MS, null)
    if (!d?.daily?.time) return null
    const temps = d.daily.temperature_2m_mean, rain = d.daily.precipitation_sum
    const monthly = Array.from({length:12},(_,m) => {
      const idx = d.daily.time.map((t,i) => new Date(t).getMonth()===m ? i : -1).filter(i=>i>=0)
      return { month:m, avgTemp: idx.reduce((s,i)=>s+temps[i],0)/(idx.length||1), avgRain: idx.reduce((s,i)=>s+rain[i],0)/(idx.length||1) }
    })
    const score = (t,r) => (t>=15&&t<=28?10:t>=10&&t<=32?5:0)+(r<3?10:r<6?5:0)
    const sorted = [...monthly].sort((a,b)=>score(b.avgTemp,b.avgRain)-score(a.avgTemp,a.avgRain))
    const peak = sorted.slice(0,3).map(m=>MONTHS[m.month])
    const avoid = monthly.filter(m=>m.avgRain>8||m.avgTemp<0||m.avgTemp>35).map(m=>MONTHS[m.month])
    return {
      peak: peak.join(', '),
      shoulder: sorted.slice(3,6).map(m=>MONTHS[m.month]).join(', '),
      avoid: [...new Set(avoid)].slice(0,3).join(', ') || 'Check forecasts',
      summary: `Based on ${year} weather data: ${peak.join(', ')} are typically the most comfortable months to visit.`,
    }
  } catch { return null }
}

// ─── Merge MealDB images into Claude dish data ────────────────────────────────

function mergeDishImages(claudeDishes, mealImages) {
  if (!claudeDishes || !mealImages) return claudeDishes || []
  return claudeDishes.map(dish => {
    const key = normalizeKey(dish.name)
    // fuzzy match: find any mealdb entry whose name overlaps
    const imgKey = Object.keys(mealImages).find(k =>
      k.includes(key.split(' ')[0]) || key.includes(k.split(' ')[0])
    )
    return imgKey ? { ...dish, image: mealImages[imgKey] } : dish
  })
}

// ─── Build tips with icons ────────────────────────────────────────────────────

function normaliseTips(rawTips, country) {
  const fallback = {
    staySafe: { summary: `Check travel advisories for ${country.name}.`, details: ['Keep copies of your passport.', 'Use registered taxis only.', 'Keep valuables out of sight.'] },
    getIn: { summary: `Check visa requirements for ${country.name} before travel.`, details: ['Passport valid for at least 6 months.', 'Check visa on arrival eligibility.'] },
    dos: { summary: `Explore ${country.name}'s culture and landmarks.`, details: ['Greet locals in the local language.', 'Try street food from busy stalls.', 'Respect religious sites.'] },
    donts: { summary: `Respect local laws and customs.`, details: ['Do not photograph people without permission.', 'Avoid public displays of affection in conservative areas.'] },
    respect: { summary: `Learn a few words in ${country.languages?.[0]||'the local language'}.`, details: ['Remove shoes before entering homes if asked.', 'Accept offered food or drinks graciously.'] },
  }
  const icons = { staySafe:'fa-shield-halved', getIn:'fa-passport', dos:'fa-circle-check', donts:'fa-circle-xmark', respect:'fa-handshake' }
  const titles = { staySafe:'Stay Safe', getIn:'Entry & Visa', dos:'What To Do', donts:'What NOT To Do', respect:'Cultural Etiquette' }
  const src = rawTips || {}
  const result = {}
  for (const key of ['staySafe','getIn','dos','donts','respect']) {
    const s = src[key] || fallback[key]
    result[key] = {
      title: titles[key],
      icon: icons[key],
      summary: s.summary || fallback[key].summary,
      details: (s.details || fallback[key].details).slice(0, 6),
      links: key === 'getIn' ? [{ label: `Official tourism — ${country.name}`, url: `https://www.google.com/search?q=${encodeURIComponent(country.name + ' official tourism website')}` }] : [],
    }
  }
  return result
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function fetchTravelGuide(identifier, countryNameParam, preloadedCountry = null) {
  const cached = getCachedGuide(identifier)
  if (cached) return cached

  const country = preloadedCountry || (await fetchCountryFacts(identifier))
  const lat = parseFloat(country.latitude) || 0
  const lon = parseFloat(country.longitude) || 0

  // Fire all requests in parallel — Claude calls + data APIs
  const [
    claudeOverview,
    claudeAttractions,
    claudeFood,
    claudeTransport,
    claudeTips,
    climate,
    mealImages,
  ] = await Promise.all([
    fetchClaudeOverview(country),
    fetchClaudeAttractions(country),
    fetchClaudeFood(country),
    fetchClaudeTransport(country),
    fetchClaudeTips(country),
    lat && lon ? fetchClimate(lat, lon) : Promise.resolve(null),
    fetchMealDBImages(country.name),
  ])

  // Merge MealDB photos into Claude-generated dish list
  const dishes = mergeDishImages(claudeFood?.dishes || [], mealImages)

  const understand = claudeOverview?.understand ||
    `${country.name} is a country in ${country.region || 'the world'} waiting to be explored.`

  const bestTimeToVisit = climate || {
    peak: 'Varies by region',
    shoulder: 'Spring & autumn',
    avoid: 'Extreme seasons',
    summary: `Research seasonal weather for ${country.capital || country.name} before travelling.`,
  }

  // Build transport with fallback
  const rawTransport = claudeTransport || {}
  const transport = {
    summary: rawTransport.summary || `Getting around ${country.name} — ask locally for the best options.`,
    bullets: rawTransport.bullets || [],
    options: (rawTransport.options || [
      { type:'bus',     name:'Public Bus',     description:`Buses connect major cities in ${country.name}.`,     availability:'good' },
      { type:'walking', name:'Walking',         description:`City centres are often walkable.`,                   availability:'excellent' },
      { type:'other',   name:'Travel Essentials',description:`Currency: ${country.currencyName||country.currency||'N/A'}. Dial: +${country.phoneCode||'check locally'}.`, availability:'excellent' },
    ]).slice(0,6)
  }
  // Always add essentials card
  if (!transport.options.find(o => o.name === 'Travel Essentials')) {
    transport.options.push({ type:'other', name:'Travel Essentials', description:`Currency: ${country.currencyName||country.currency||'N/A'}. Phone code: +${country.phoneCode||'N/A'}. Driving side: ${country.drivingSide||'N/A'}.`, availability:'excellent' })
  }

  const accommodationAreas = (claudeOverview?.accommodationAreas?.length
    ? claudeOverview.accommodationAreas
    : country.capital
      ? [{ name: country.capital, vibe:'Capital city — the main hub for most visitors, with hotels, transport, and tourist infrastructure.', budget:'mid', bestFor:'First-time visitors', notes:'' }]
      : []
  )

  const result = {
    country,
    overview: {
      understand,
      bestTimeToVisit,
      accommodationAreas,
      wikiExtract: understand,
    },
    attractions: {
      mustSee:     claudeAttractions?.mustSee     || [],
      thingsToDo:  claudeAttractions?.thingsToDo  || [],
      localGems:   claudeAttractions?.localGems   || [],
    },
    transport,
    food: {
      summary: claudeFood?.summary || `Explore the regional cuisine of ${country.name}.`,
      dishes,
      eat:   claudeFood?.eat   || [],
      drink: claudeFood?.drink || [],
    },
    practicalTips: normaliseTips(claudeTips, country),
  }

  setCachedGuide(identifier, result)
  return result
}

window.TravelAPIs = { fetchTravelGuide, getCachedGuide, fetchCountryFacts }
