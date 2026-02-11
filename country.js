const countryName = new URLSearchParams(location.search).get('name');
const flagImage = document.querySelector('.country-details img');
const countryNameH1 = document.querySelector('.country-details h1');
const nativeName = document.querySelector('.native-name');
const population = document.querySelector('.population');
const region = document.querySelector('.region');
const capital = document.querySelector('.capital');
const currencies = document.querySelector('.currencies');
const languages = document.querySelector('.languages');
const borderCountries = document.querySelector('.border-countries');

fetch(`https://restcountries.com/v3.1/name/${countryName}?fullText=true`)
  .then((res) => res.json())
  .then(([country]) => {
    flagImage.src = country.flags.svg;
    countryNameH1.innerText = country.name.common;
    population.innerText = country.population.toLocaleString('en-IN');
    region.innerText = country.region;

    if (country.capital) {
      capital.innerText = country.capital?.[0];
    }

    if (country.name.nativeName) {
      nativeName.innerText = Object.values(country.name.nativeName)[0].common;
    } else {
      nativeName.innerText = country.name.common;
    }

    if (country.currencies) {
      currencies.innerText = Object.values(country.currencies)
        .map((currency) => currency.name)
        .join(', ');
    }

    if (country.languages) {
      languages.innerText = Object.values(country.languages).join(', ');
    }

    if (country.borders) {
      country.borders.forEach((border) => {
        fetch(`https://restcountries.com/v3.1/alpha/${border}`)
          .then((res) => res.json())
          .then(([borderCountry]) => {
            const borderCountryTag = document.createElement('a');
            borderCountryTag.innerText = borderCountry.name.common;
            borderCountryTag.href = `country.html?name=${borderCountry.name.common}`;
            borderCountries.append(borderCountryTag);
          });
      });
    }
  });

const themeChanger = document.querySelector('.theme-changer');
const body = document.body;

// Load saved theme on page load
if (localStorage.getItem('theme') === 'dark') {
  body.classList.add('dark')
  const icon = themeChanger.querySelector('i')
  const text = themeChanger.querySelector('.theme-text')
  icon.classList.remove('fa-moon')
  icon.classList.add('fa-sun')
  text.textContent = 'Light Mode'
}

themeChanger.addEventListener('click', () => {
  body.classList.toggle('dark')
  const icon = themeChanger.querySelector('i')
  const text = themeChanger.querySelector('.theme-text')
  
  if (body.classList.contains('dark')) {
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
});
