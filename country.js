const API_BASE = 'https://api.geocoded.me'

const countryCode = new URLSearchParams(location.search).get('code')
const countryName = new URLSearchParams(location.search).get('name')

const loadingState = document.getElementById('loading-state')
const countryPage = document.getElementById('country-page')
const errorState = document.getElementById('error-state')
const themeChanger = document.querySelector('.theme-changer')

const TRANSPORT_ICONS = {
  metro: 'fa-train-subway',
  bus: 'fa-bus',
  train: 'fa-train',
  rideshare: 'fa-taxi',
  walking: 'fa-person-walking',
  bike: 'fa-bicycle',
  ferry: 'fa-ship',
  other: 'fa-circle-info',
}

const BUDGET_LABELS = { budget: 'Budget', mid: 'Mid-range', luxury: 'Luxury', mixed: 'Mixed' }

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str ?? ''
  return div.innerHTML
}

function initTheme() {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark')
    const icon = themeChanger.querySelector('i')
    const text = themeChanger.querySelector('.theme-text')
    icon.classList.remove('fa-moon')
    icon.classList.add('fa-sun')
    text.textContent = 'Light Mode'
  }

  themeChanger.addEventListener('click', () => {
    document.body.classList.toggle('dark')
    const icon = themeChanger.querySelector('i')
    const text = themeChanger.querySelector('.theme-text')

    if (document.body.classList.contains('dark')) {
      localStorage.setItem('theme', 'dark')
      icon.classList.remove('fa-moon')
      icon.classList.add('fa-sun')
      text.textContent = 'Light Mode'
    } else {
      localStorage.setItem('theme', 'light')
      icon.classList.remove('fa-sun')
      icon.classList.add('fa-moon')
      text.textContent = 'Dark Mode'
    }
  })
}

function initTabs() {
  document.querySelectorAll('.guide-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab
      document.querySelectorAll('.guide-tab').forEach((t) => {
        t.classList.toggle('active', t === tab)
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false')
      })
      document.querySelectorAll('.guide-panel').forEach((panel) => {
        const isActive = panel.id === `panel-${target}`
        panel.classList.toggle('active', isActive)
        panel.hidden = !isActive
      })
    })
  })
}

function initAccordions() {
  document.querySelectorAll('.accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item')
      const isOpen = item.classList.contains('open')
      document.querySelectorAll('.accordion-item').forEach((el) => {
        el.classList.remove('open')
        el.querySelector('.accordion-trigger')?.setAttribute('aria-expanded', 'false')
      })
      if (!isOpen) {
        item.classList.add('open')
        trigger.setAttribute('aria-expanded', 'true')
      }
    })
  })
}

function renderHero(country, overview) {
  document.getElementById('country-flag').src =
    country.flagUrl || `https://flagcdn.com/w640/${country.iso2.toLowerCase()}.png`
  document.getElementById('country-flag').alt = `${country.name} flag`
  document.getElementById('country-name').textContent = country.name
  document.title = `${country.name} | Country Guide`
  document.getElementById('hero-meta').textContent =
    `${country.capital || 'N/A'} · ${country.region || 'N/A'} · ${country.subregion || ''}`

  const extract = overview?.understand || overview?.wikiExtract || ''
  document.getElementById('hero-extract').textContent = extract.slice(0, 320) + (extract.length > 320 ? '…' : '')

  const bt = overview?.bestTimeToVisit
  document.getElementById('hero-badges').innerHTML = `
    ${bt ? `<span class="badge badge-accent"><i class="fa-solid fa-sun"></i> Best: ${escapeHtml(bt.peak)}</span>` : ''}
    <span class="badge"><i class="fa-solid fa-users"></i> ${escapeHtml(country.population?.toLocaleString('en-US') ?? '')}</span>
    <span class="badge"><i class="fa-solid fa-coins"></i> ${escapeHtml(country.currencyName || country.currency || 'N/A')}</span>
    <span class="badge"><i class="fa-solid fa-phone"></i> +${escapeHtml(country.phoneCode || 'N/A')}</span>
  `
}

function factItem(label, value) {
  return `<p><b>${escapeHtml(label)}</b><span>${escapeHtml(value ?? 'N/A')}</span></p>`
}

async function renderBorderCountries(neighbours, container) {
  container.innerHTML = '<b>Border Countries:</b>'
  const results = await Promise.all(
    neighbours.map(async (code) => {
      try {
        const res = await fetch(`${API_BASE}/countries/${code}?fields=iso2,name`)
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    })
  )
  const borders = results.filter(Boolean)
  if (!borders.length) {
    container.innerHTML += ' <span>None</span>'
    return
  }
  borders.forEach((bc) => {
    const link = document.createElement('a')
    link.textContent = bc.name
    link.href = `country.html?code=${bc.iso2}`
    container.append(link)
  })
}

function renderOverview(country, overview) {
  const bt = overview.bestTimeToVisit
  document.getElementById('overview-content').innerHTML = `
    ${overview.understand ? `
    <div class="info-card full-width">
      <h3><i class="fa-solid fa-book-open"></i> Understand ${escapeHtml(country.name)}</h3>
      <p class="card-summary">${escapeHtml(overview.understand)}</p>
    </div>` : ''}

    <div class="info-card">
      <h3><i class="fa-solid fa-circle-info"></i> Quick Facts</h3>
      <div class="details-text">
        ${factItem('Native Name', country.native || country.name)}
        ${factItem('Population', country.population?.toLocaleString('en-US'))}
        ${factItem('Capital', country.capital)}
        ${factItem('Languages', country.languages?.join(', '))}
        ${factItem('Currency', country.currencyName ? `${country.currencyName} (${country.currency})` : country.currency)}
        ${factItem('Driving Side', country.drivingSide)}
        ${factItem('Phone Code', country.phoneCode ? `+${country.phoneCode}` : 'N/A')}
      </div>
      <div class="border-countries" id="border-countries"><b>Border Countries:</b></div>
    </div>

    <div class="info-card">
      <h3><i class="fa-solid fa-calendar-days"></i> Best Time to Visit</h3>
      <p class="card-summary">${escapeHtml(bt.summary)}</p>
      <div class="season-grid">
        <div class="season-item season-peak"><span class="season-label">Peak</span><span class="season-value">${escapeHtml(bt.peak)}</span></div>
        <div class="season-item season-shoulder"><span class="season-label">Shoulder</span><span class="season-value">${escapeHtml(bt.shoulder)}</span></div>
        <div class="season-item season-avoid"><span class="season-label">Avoid</span><span class="season-value">${escapeHtml(bt.avoid)}</span></div>
      </div>
    </div>

    <div class="info-card full-width">
      <h3><i class="fa-solid fa-bed"></i> Where to Stay</h3>
      <p class="card-summary">Recommended areas and neighbourhoods — choose based on your travel style and budget.</p>
      <div class="card-grid">
        ${overview.accommodationAreas.map((area) => `
          <article class="guide-card">
            <div class="card-header">
              <h4>${escapeHtml(area.name)}</h4>
              <span class="badge badge-budget">${BUDGET_LABELS[area.budget] || area.budget}</span>
            </div>
            <p class="card-vibe">${escapeHtml(area.vibe)}</p>
            <p class="card-meta"><i class="fa-solid fa-user-check"></i> ${escapeHtml(area.bestFor)}</p>
            ${area.notes ? `<p class="card-note">${escapeHtml(area.notes)}</p>` : ''}
          </article>`).join('')}
      </div>
    </div>
  `

  const borderEl = document.getElementById('border-countries')
  if (country.neighbours?.length) renderBorderCountries(country.neighbours, borderEl)
  else borderEl.innerHTML = '<b>Border Countries:</b> <span>None</span>'
}

function placeCard(item, badgeClass, badgeLabel) {
  return `
    <article class="guide-card">
      <span class="spot-type badge ${badgeClass}">${badgeLabel}</span>
      <h4>${escapeHtml(item.name)}</h4>
      ${item.tag ? `<p class="card-tag">${escapeHtml(item.tag)}</p>` : ''}
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    </article>
  `
}

function emptyMsg(text) {
  return `<p class="card-summary">${text}</p>`
}

function renderAttractions({ mustSee, localGems, thingsToDo }) {
  document.getElementById('attractions-content').innerHTML = `
    <div class="section-block">
      <h3><i class="fa-solid fa-star"></i> Must-See Places</h3>
      <p class="card-summary">The iconic places every visitor should experience.</p>
      <div class="card-grid">${mustSee.length ? mustSee.map((s) => placeCard(s, 'badge-must', 'Must-See')).join('') : emptyMsg('No must-see listings available.')}</div>
    </div>
    <div class="section-block">
      <h3><i class="fa-solid fa-person-hiking"></i> Things To Do</h3>
      <p class="card-summary">Activities and experiences recommended for travelers.</p>
      <div class="card-grid">${thingsToDo.length ? thingsToDo.map((s) => placeCard(s, 'badge-accent', 'Activity')).join('') : emptyMsg('No activity listings available.')}</div>
    </div>
    <div class="section-block">
      <h3><i class="fa-solid fa-gem"></i> Local Gems & Other Destinations</h3>
      <p class="card-summary">Lesser-known places beyond the main tourist trail.</p>
      <div class="card-grid">${localGems.length ? localGems.map((s) => placeCard(s, 'badge-gem', 'Local Gem')).join('') : emptyMsg('No local gem listings available.')}</div>
    </div>
  `
}

function renderTransport(transport) {
  const el = document.getElementById('transport-content')
  el.innerHTML = `
    <p class="card-summary">${escapeHtml(transport.summary)}</p>
    ${transport.bullets?.length ? `
      <ul class="transport-bullets">${transport.bullets.slice(0, 6).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
    <div class="card-grid">
      ${transport.options.map((opt) => `
        <article class="guide-card transport-card">
          <div class="transport-icon"><i class="fa-solid ${TRANSPORT_ICONS[opt.type] || 'fa-route'}"></i></div>
          <h4>${escapeHtml(opt.name)}</h4>
          <span class="badge badge-avail badge-${opt.availability}">${escapeHtml(opt.availability)}</span>
          <p>${escapeHtml(opt.description)}</p>
          ${opt.costHint ? `<p class="card-note"><i class="fa-solid fa-tag"></i> ${escapeHtml(opt.costHint)}</p>` : ''}
        </article>`).join('')}
    </div>
  `
}

function foodCard(item, showImage = false) {
  return `
    <article class="guide-card food-card${showImage && item.image ? ' food-card--img' : ''}">
      ${showImage && item.image ? `<img class="food-thumb" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />` : ''}
      <div class="food-card-body">
        ${item.mustTry ? '<span class="badge badge-must">Must Try</span>' : ''}
        <h4>${escapeHtml(item.name)}</h4>
        ${item.tag ? `<p class="card-tag">${escapeHtml(item.tag)}</p>` : ''}
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      </div>
    </article>
  `
}

function renderFood(food) {
  document.getElementById('food-content').innerHTML = `
    <p class="card-summary">${escapeHtml(food.summary)}</p>

    <div class="section-block">
      <h3><i class="fa-solid fa-bowl-food"></i> Recommended Dishes</h3>
      <p class="card-summary">Dishes you absolutely have to try — with tasting notes and where to find them.</p>
      <div class="card-grid card-grid--food">
        ${food.dishes.length ? food.dishes.map((d) => foodCard(d, true)).join('') : emptyMsg('No dish database entries — see Eat section below.')}
      </div>
    </div>

    <div class="section-block">
      <h3><i class="fa-solid fa-utensils"></i> Where & What To Eat</h3>
      <p class="card-summary">Where to eat and what to order like a local.</p>
      <div class="card-grid">${food.eat.length ? food.eat.map((d) => foodCard(d)).join('') : emptyMsg('No specific recommendations available for this destination.')}</div>
    </div>

    <div class="section-block">
      <h3><i class="fa-solid fa-mug-hot"></i> Drinks & Beverages</h3>
      <p class="card-summary">Local drinks worth seeking out.</p>
      <div class="card-grid">${food.drink.length ? food.drink.map((d) => foodCard(d)).join('') : emptyMsg('No specific drink recommendations available.')}</div>
    </div>
  `
}

function renderTips(tips) {
  const sections = [tips.staySafe, tips.getIn, tips.dos, tips.donts, tips.respect]
  document.getElementById('tips-content').innerHTML = sections
    .map((section, i) => `
      <div class="accordion-item${i === 0 ? ' open' : ''}">
        <button class="accordion-trigger" aria-expanded="${i === 0 ? 'true' : 'false'}">
          <span class="accordion-title"><i class="fa-solid ${section.icon}"></i> ${escapeHtml(section.title)}</span>
          <i class="fa-solid fa-chevron-down accordion-chevron"></i>
        </button>
        <div class="accordion-body">
          <p class="accordion-summary">${escapeHtml(section.summary)}</p>
          ${section.details.length ? `<ul>${section.details.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
          ${section.links?.length ? `<div class="accordion-links">${section.links.map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)} <i class="fa-solid fa-arrow-up-right-from-square"></i></a>`).join('')}</div>` : ''}
        </div>
      </div>`)
    .join('')
  initAccordions()
}

function renderGuide(guide) {
  renderHero(guide.country, guide.overview)
  renderOverview(guide.country, guide.overview)
  renderAttractions(guide.attractions)
  renderTransport(guide.transport)
  renderFood(guide.food)
  renderTips(guide.practicalTips)
}

function showPageShell(country) {
  renderHero(country, { understand: 'Generating your AI-powered travel guide…' })
  document.getElementById('overview-content').innerHTML =
    '<p class="panel-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading detailed travel guide…</p>'
  loadingState.hidden = true
  countryPage.hidden = false
  initTabs()
}

async function loadCountry() {
  const identifier = countryCode || countryName
  if (!identifier) {
    loadingState.hidden = true
    errorState.hidden = false
    return
  }

  initTheme()

  try {
    const cached = window.TravelAPIs.getCachedGuide(identifier)
    if (cached) {
      renderGuide(cached)
      loadingState.hidden = true
      countryPage.hidden = false
      initTabs()
      return
    }

    const country = await window.TravelAPIs.fetchCountryFacts(identifier)
    showPageShell(country)
    const guide = await window.TravelAPIs.fetchTravelGuide(identifier, countryName, country)
    renderGuide(guide)
  } catch {
    loadingState.hidden = true
    errorState.hidden = false
  }
}

loadCountry()
