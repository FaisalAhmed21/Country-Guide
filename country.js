const API_BASE = 'https://api.geocoded.me'

const countryCode = new URLSearchParams(location.search).get('code')
const countryName = new URLSearchParams(location.search).get('name')

const flagImage = document.querySelector('.country-details img')
const countryNameH1 = document.querySelector('.country-details h1')
const nativeName = document.querySelector('.native-name')
const population = document.querySelector('.population')
const region = document.querySelector('.region')
const capital = document.querySelector('.capital')
const currencies = document.querySelector('.currencies')
const languages = document.querySelector('.languages')
const borderCountries = document.querySelector('.border-countries')
const themeChanger = document.querySelector('.theme-changer')

async function loadCountry() {
  const identifier = countryCode || countryName
  if (!identifier) {
    countryNameH1.textContent = 'Country not found'
    return
  }

  try {
    const res = await fetch(`${API_BASE}/countries/${identifier}`)
    if (!res.ok) throw new Error('Country not found')

    const country = await res.json()
    document.title = `${country.name} | Country Guide`

    flagImage.src = country.flagUrl || `https://flagcdn.com/w640/${country.iso2.toLowerCase()}.png`
    flagImage.alt = `${country.name} flag`
    countryNameH1.textContent = country.name
    nativeName.textContent = country.native || country.name
    population.textContent = country.population.toLocaleString('en-US')
    region.textContent = country.region || 'N/A'
    capital.textContent = country.capital || 'N/A'
    currencies.textContent = country.currencyName
      ? `${country.currencyName} (${country.currency})`
      : country.currency || 'N/A'
    languages.textContent = country.languages?.join(', ') || 'N/A'

    if (country.neighbours?.length) {
      await renderBorderCountries(country.neighbours)
    } else {
      borderCountries.innerHTML = '<b>Border Countries:</b> <span>None</span>'
    }
  } catch {
    countryNameH1.textContent = 'Country not found'
    flagImage.style.display = 'none'
  }
}

async function renderBorderCountries(neighbours) {
  borderCountries.innerHTML = '<b>Border Countries:</b>'

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

  results
    .filter(Boolean)
    .forEach((borderCountry) => {
      const link = document.createElement('a')
      link.textContent = borderCountry.name
      link.href = `country.html?code=${borderCountry.iso2}`
      borderCountries.append(link)
    })
}

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

loadCountry()
