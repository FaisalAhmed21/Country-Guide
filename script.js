const countriesContainer = document.querySelector('.countries-container')
const filterByRegion = document.querySelector('.filter-by-region')
const themeChanger = document.querySelector('.theme-changer')

let allCountriesData = []

fetch('https://restcountries.com/v3.1/all')
  .then((res) => res.json())
  .then((data) => {
    allCountriesData = data
    renderCountries(data)
  })

filterByRegion.addEventListener('change', (e) => {
  fetch(`https://restcountries.com/v3.1/region/${filterByRegion.value}`)
    .then((res) => res.json())
    .then((data) => {
      renderCountries(data)
      allCountriesData = data
    })
})

function renderCountries(data) {
  countriesContainer.innerHTML = ''
  
  if (!data || data.length === 0) {
    countriesContainer.innerHTML = '<p style="text-align: center; width: 100%; padding: 40px; font-size: 18px; color: var(--text-color);">No countries found</p>'
    return
  }
  
  data.forEach((country) => {
    const countryCard = document.createElement('a')
    countryCard.classList.add('country-card')
    countryCard.href = `country.html?name=${country.name.common}`
    countryCard.innerHTML = `
          <img src="${country.flags.svg}" alt="${country.name.common} flag" />
          <div class="card-text">
              <h3 class="card-title">${country.name.common}</h3>
              <p><b>Population: </b>${country.population.toLocaleString(
                'en-IN'
              )}</p>
              <p><b>Region: </b>${country.region}</p>
              <p><b>Capital: </b>${country.capital?.[0] || 'N/A'}</p>
          </div>
  `
    countriesContainer.append(countryCard)
  })
}

// Load saved theme on page load
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
