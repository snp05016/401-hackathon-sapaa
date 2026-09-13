// Location catalogue for Discover. `id` matches JobSpy's `country_indeed` value.
// Regions carry the abbreviation JobSpy/Indeed expect in "City, XX" strings
// (full name where the country has no standard abbreviation).
export interface Region { code: string; label: string; cities: string[] }
export interface Country { id: string; label: string; regions: Region[] }

const r = (code: string, label: string, cities: string[]): Region => ({ code, label, cities });

export const COUNTRIES: Country[] = [
  {
    id: "canada", label: "Canada", regions: [
      r("AB", "Alberta", ["Calgary", "Edmonton", "Red Deer", "Lethbridge", "Fort McMurray"]),
      r("BC", "British Columbia", ["Vancouver", "Victoria", "Burnaby", "Surrey", "Kelowna", "Richmond"]),
      r("MB", "Manitoba", ["Winnipeg", "Brandon"]),
      r("NB", "New Brunswick", ["Moncton", "Saint John", "Fredericton"]),
      r("NL", "Newfoundland and Labrador", ["St. John's"]),
      r("NS", "Nova Scotia", ["Halifax", "Sydney"]),
      r("NT", "Northwest Territories", ["Yellowknife"]),
      r("NU", "Nunavut", ["Iqaluit"]),
      r("ON", "Ontario", ["Toronto", "Ottawa", "Mississauga", "Hamilton", "Waterloo", "Kitchener", "London", "Windsor", "Kingston", "Markham"]),
      r("PE", "Prince Edward Island", ["Charlottetown"]),
      r("QC", "Quebec", ["Montreal", "Quebec City", "Laval", "Gatineau", "Sherbrooke"]),
      r("SK", "Saskatchewan", ["Saskatoon", "Regina"]),
      r("YT", "Yukon", ["Whitehorse"]),
    ],
  },
  {
    id: "usa", label: "United States", regions: [
      r("AL", "Alabama", ["Birmingham", "Huntsville", "Montgomery"]),
      r("AK", "Alaska", ["Anchorage"]),
      r("AZ", "Arizona", ["Phoenix", "Tucson", "Tempe", "Scottsdale"]),
      r("AR", "Arkansas", ["Little Rock", "Bentonville"]),
      r("CA", "California", ["San Francisco", "San Jose", "Los Angeles", "San Diego", "Sacramento", "Palo Alto", "Irvine", "Santa Clara", "Oakland"]),
      r("CO", "Colorado", ["Denver", "Boulder", "Colorado Springs"]),
      r("CT", "Connecticut", ["Hartford", "Stamford", "New Haven"]),
      r("DE", "Delaware", ["Wilmington"]),
      r("DC", "District of Columbia", ["Washington"]),
      r("FL", "Florida", ["Miami", "Orlando", "Tampa", "Jacksonville"]),
      r("GA", "Georgia", ["Atlanta", "Savannah"]),
      r("HI", "Hawaii", ["Honolulu"]),
      r("ID", "Idaho", ["Boise"]),
      r("IL", "Illinois", ["Chicago", "Naperville", "Springfield"]),
      r("IN", "Indiana", ["Indianapolis", "Bloomington"]),
      r("IA", "Iowa", ["Des Moines", "Cedar Rapids"]),
      r("KS", "Kansas", ["Wichita", "Overland Park"]),
      r("KY", "Kentucky", ["Louisville", "Lexington"]),
      r("LA", "Louisiana", ["New Orleans", "Baton Rouge"]),
      r("ME", "Maine", ["Portland"]),
      r("MD", "Maryland", ["Baltimore", "Bethesda"]),
      r("MA", "Massachusetts", ["Boston", "Cambridge", "Worcester"]),
      r("MI", "Michigan", ["Detroit", "Ann Arbor", "Grand Rapids"]),
      r("MN", "Minnesota", ["Minneapolis", "Saint Paul", "Rochester"]),
      r("MS", "Mississippi", ["Jackson"]),
      r("MO", "Missouri", ["St. Louis", "Kansas City"]),
      r("MT", "Montana", ["Billings", "Bozeman"]),
      r("NE", "Nebraska", ["Omaha", "Lincoln"]),
      r("NV", "Nevada", ["Las Vegas", "Reno"]),
      r("NH", "New Hampshire", ["Manchester", "Nashua"]),
      r("NJ", "New Jersey", ["Newark", "Jersey City", "Princeton"]),
      r("NM", "New Mexico", ["Albuquerque", "Santa Fe"]),
      r("NY", "New York", ["New York", "Brooklyn", "Buffalo", "Rochester", "Albany"]),
      r("NC", "North Carolina", ["Charlotte", "Raleigh", "Durham"]),
      r("ND", "North Dakota", ["Fargo"]),
      r("OH", "Ohio", ["Columbus", "Cleveland", "Cincinnati"]),
      r("OK", "Oklahoma", ["Oklahoma City", "Tulsa"]),
      r("OR", "Oregon", ["Portland", "Beaverton", "Eugene"]),
      r("PA", "Pennsylvania", ["Philadelphia", "Pittsburgh"]),
      r("RI", "Rhode Island", ["Providence"]),
      r("SC", "South Carolina", ["Charleston", "Columbia", "Greenville"]),
      r("SD", "South Dakota", ["Sioux Falls"]),
      r("TN", "Tennessee", ["Nashville", "Memphis", "Knoxville"]),
      r("TX", "Texas", ["Austin", "Dallas", "Houston", "San Antonio", "Plano"]),
      r("UT", "Utah", ["Salt Lake City", "Provo", "Lehi"]),
      r("VT", "Vermont", ["Burlington"]),
      r("VA", "Virginia", ["Arlington", "Richmond", "Reston"]),
      r("WA", "Washington", ["Seattle", "Bellevue", "Redmond", "Spokane"]),
      r("WV", "West Virginia", ["Charleston"]),
      r("WI", "Wisconsin", ["Milwaukee", "Madison"]),
      r("WY", "Wyoming", ["Cheyenne"]),
    ],
  },
  {
    id: "uk", label: "United Kingdom", regions: [
      r("England", "England", ["London", "Manchester", "Birmingham", "Bristol", "Leeds", "Cambridge", "Oxford", "Newcastle"]),
      r("Scotland", "Scotland", ["Edinburgh", "Glasgow", "Aberdeen"]),
      r("Wales", "Wales", ["Cardiff", "Swansea"]),
      r("Northern Ireland", "Northern Ireland", ["Belfast"]),
    ],
  },
  {
    id: "australia", label: "Australia", regions: [
      r("NSW", "New South Wales", ["Sydney", "Newcastle", "Wollongong"]),
      r("VIC", "Victoria", ["Melbourne", "Geelong"]),
      r("QLD", "Queensland", ["Brisbane", "Gold Coast", "Cairns"]),
      r("WA", "Western Australia", ["Perth"]),
      r("SA", "South Australia", ["Adelaide"]),
      r("TAS", "Tasmania", ["Hobart"]),
      r("ACT", "Australian Capital Territory", ["Canberra"]),
      r("NT", "Northern Territory", ["Darwin"]),
    ],
  },
  {
    id: "india", label: "India", regions: [
      r("Karnataka", "Karnataka", ["Bengaluru", "Mysuru"]),
      r("Maharashtra", "Maharashtra", ["Mumbai", "Pune", "Nagpur"]),
      r("Delhi", "Delhi NCR", ["New Delhi", "Gurugram", "Noida"]),
      r("Telangana", "Telangana", ["Hyderabad"]),
      r("Tamil Nadu", "Tamil Nadu", ["Chennai", "Coimbatore"]),
      r("West Bengal", "West Bengal", ["Kolkata"]),
      r("Gujarat", "Gujarat", ["Ahmedabad", "Surat"]),
      r("Kerala", "Kerala", ["Kochi", "Thiruvananthapuram"]),
    ],
  },
  {
    id: "germany", label: "Germany", regions: [
      r("Bayern", "Bavaria", ["Munich", "Nuremberg"]),
      r("Berlin", "Berlin", ["Berlin"]),
      r("Hamburg", "Hamburg", ["Hamburg"]),
      r("Hessen", "Hesse", ["Frankfurt", "Darmstadt"]),
      r("Nordrhein-Westfalen", "North Rhine-Westphalia", ["Cologne", "Düsseldorf", "Dortmund"]),
      r("Baden-Württemberg", "Baden-Württemberg", ["Stuttgart", "Karlsruhe"]),
    ],
  },
  {
    id: "ireland", label: "Ireland", regions: [
      r("Leinster", "Leinster", ["Dublin"]),
      r("Munster", "Munster", ["Cork", "Limerick"]),
      r("Connacht", "Connacht", ["Galway"]),
    ],
  },
  {
    id: "netherlands", label: "Netherlands", regions: [
      r("Noord-Holland", "North Holland", ["Amsterdam", "Haarlem"]),
      r("Zuid-Holland", "South Holland", ["Rotterdam", "The Hague", "Delft"]),
      r("Utrecht", "Utrecht", ["Utrecht"]),
      r("Noord-Brabant", "North Brabant", ["Eindhoven"]),
    ],
  },
  {
    id: "france", label: "France", regions: [
      r("Île-de-France", "Île-de-France", ["Paris"]),
      r("Auvergne-Rhône-Alpes", "Auvergne-Rhône-Alpes", ["Lyon", "Grenoble"]),
      r("Occitanie", "Occitanie", ["Toulouse", "Montpellier"]),
      r("Provence-Alpes-Côte d'Azur", "Provence-Alpes-Côte d'Azur", ["Marseille", "Nice"]),
    ],
  },
  { id: "singapore", label: "Singapore", regions: [] },
  { id: "hong kong", label: "Hong Kong", regions: [] },
  { id: "japan", label: "Japan", regions: [r("Tokyo", "Tokyo", ["Tokyo"]), r("Osaka", "Osaka", ["Osaka"])] },
  { id: "new zealand", label: "New Zealand", regions: [r("Auckland", "Auckland", ["Auckland"]), r("Wellington", "Wellington", ["Wellington"]), r("Canterbury", "Canterbury", ["Christchurch"])] },
  { id: "spain", label: "Spain", regions: [r("Madrid", "Madrid", ["Madrid"]), r("Cataluña", "Catalonia", ["Barcelona"])] },
  { id: "italy", label: "Italy", regions: [r("Lombardia", "Lombardy", ["Milan"]), r("Lazio", "Lazio", ["Rome"])] },
  { id: "poland", label: "Poland", regions: [r("Mazowieckie", "Masovia", ["Warsaw"]), r("Małopolskie", "Lesser Poland", ["Kraków"])] },
  { id: "sweden", label: "Sweden", regions: [r("Stockholm", "Stockholm", ["Stockholm"]), r("Skåne", "Skåne", ["Malmö"])] },
  { id: "switzerland", label: "Switzerland", regions: [r("Zürich", "Zürich", ["Zurich"]), r("Genève", "Geneva", ["Geneva"])] },
  { id: "brazil", label: "Brazil", regions: [r("São Paulo", "São Paulo", ["São Paulo", "Campinas"]), r("Rio de Janeiro", "Rio de Janeiro", ["Rio de Janeiro"])] },
  { id: "mexico", label: "Mexico", regions: [r("CDMX", "Mexico City", ["Mexico City"]), r("Jalisco", "Jalisco", ["Guadalajara"]), r("Nuevo León", "Nuevo León", ["Monterrey"])] },
  { id: "uae", label: "United Arab Emirates", regions: [r("Dubai", "Dubai", ["Dubai"]), r("Abu Dhabi", "Abu Dhabi", ["Abu Dhabi"])] },
  { id: "south africa", label: "South Africa", regions: [r("Gauteng", "Gauteng", ["Johannesburg", "Pretoria"]), r("Western Cape", "Western Cape", ["Cape Town"])] },
];

export function findCountry(id: string): Country | undefined {
  return COUNTRIES.find((country) => country.id === id);
}

/** Builds the location string JobSpy expects: "City, ON" › "Ontario, Canada" › "Canada". */
export function buildLocation(countryId: string, regionCode: string, city: string): string {
  const country = findCountry(countryId);
  if (!country) return city.trim();
  const region = country.regions.find((entry) => entry.code === regionCode);
  const trimmedCity = city.trim();
  if (trimmedCity) return region ? `${trimmedCity}, ${region.code}` : `${trimmedCity}, ${country.label}`;
  if (region) return `${region.label}, ${country.label}`;
  return country.label;
}
