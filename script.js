const API_BASE = 'https://api.geocoded.me'
const LIST_FIELDS = 'iso2,name,population,capital,region'

const countriesContainer = document.querySelector('.countries-container')
const filterButtons = document.querySelectorAll('.continent-btn')
const searchInput = document.querySelector('.search-input')
const themeChanger = document.querySelector('.theme-changer')
const countryCount = document.querySelector('.country-count')

let allCountriesData = []
let activeRegion = 'all'

async function fetchCountries() {
  try {
    const res = await fetch(`${API_BASE}/countries?limit=300&fields=${LIST_FIELDS}`)
    if (!res.ok) throw new Error('Failed to load countries')

    const { data } = await res.json()
    allCountriesData = data
    renderCountries(data)
  } catch {
    countriesContainer.innerHTML =
      '<p class="status-message error">Unable to load countries. Please check your connection and refresh.</p>'
  }
}

function getFlagUrl(iso2) {
  return `https://flagcdn.com/w320/${iso2.toLowerCase()}.png`
}

function filterCountries() {
  const query = searchInput.value.trim().toLowerCase()
  let filtered = allCountriesData

  if (activeRegion !== 'all') {
    filtered = filtered.filter((country) => country.region === activeRegion)
  }

  if (query) {
    filtered = filtered.filter((country) =>
      country.name.toLowerCase().includes(query) ||
      country.capital?.toLowerCase().includes(query)
    )
  }

  renderCountries(filtered)
}

function renderCountries(data) {
  countriesContainer.innerHTML = ''

  if (countryCount) {
    const label = data.length === 1 ? 'country' : 'countries'
    countryCount.textContent = `${data.length} ${label}`
  }

  if (!data || data.length === 0) {
    countriesContainer.innerHTML =
      '<p class="status-message">No countries found. Try another region or search term.</p>'
    return
  }

  data.forEach((country) => {
    const countryCard = document.createElement('a')
    countryCard.classList.add('country-card')
    countryCard.href = `country.html?code=${country.iso2}`
    countryCard.innerHTML = `
      <div class="card-flag">
        <img src="${getFlagUrl(country.iso2)}" alt="${country.name} flag" loading="lazy" />
      </div>
      <div class="card-text">
        <h3 class="card-title">${country.name}</h3>
        <p><b>Population:</b> ${country.population.toLocaleString('en-US')}</p>
        <p><b>Region:</b> ${country.region || 'N/A'}</p>
        <p><b>Capital:</b> ${country.capital || 'N/A'}</p>
      </div>
    `
    countriesContainer.append(countryCard)
  })
}

filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    filterButtons.forEach((btn) => btn.classList.remove('active'))
    button.classList.add('active')
    activeRegion = button.dataset.region
    filterCountries()
  })
})

searchInput.addEventListener('input', filterCountries)

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

fetchCountries()
