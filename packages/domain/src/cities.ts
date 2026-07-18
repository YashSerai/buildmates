export type CanonicalCity = {
  id: string;
  label: string;
  country: string;
  region?: string;
  latitude: number;
  longitude: number;
  aliases: readonly string[];
};

export const CANONICAL_CITIES = [
  city("vancouver-ca", "Vancouver", "Canada", 49.2827, -123.1207, ["Vancouver BC", "Vancouver, BC"]),
  city("burnaby-ca", "Burnaby", "Canada", 49.2488, -122.9805, ["Burnaby BC", "Burnaby, BC"]),
  city("surrey-ca", "Surrey", "Canada", 49.1913, -122.849, ["Surrey BC", "Surrey, BC"]),
  city("richmond-ca", "Richmond", "Canada", 49.1666, -123.1336, ["Richmond BC", "Richmond, BC"]),
  city("north-vancouver-ca", "North Vancouver", "Canada", 49.3200, -123.0724, ["North Vancouver BC", "North Vancouver, BC"]),
  city("toronto-ca", "Toronto", "Canada", 43.6532, -79.3832, ["Toronto ON", "Toronto, ON"]),
  city("mississauga-ca", "Mississauga", "Canada", 43.5890, -79.6441, ["Mississauga ON", "Mississauga, ON"]),
  city("san-francisco-us", "San Francisco", "United States", 37.7749, -122.4194, ["SF", "San Francisco Bay Area", "Bay Area"]),
  city("oakland-us", "Oakland", "United States", 37.8044, -122.2712, ["Oakland CA"]),
  city("berkeley-us", "Berkeley", "United States", 37.8715, -122.2730, ["Berkeley CA"]),
  city("san-jose-us", "San Jose", "United States", 37.3382, -121.8863, ["San Jose CA"]),
  city("palo-alto-us", "Palo Alto", "United States", 37.4419, -122.1430, ["Palo Alto CA"]),
  city("new-york-us", "New York City", "United States", 40.7128, -74.006, ["New York", "NYC"]),
  city("jersey-city-us", "Jersey City", "United States", 40.7178, -74.0431, ["Jersey City NJ"]),
  city("newark-us", "Newark", "United States", 40.7357, -74.1724, ["Newark NJ"]),
  city("hoboken-us", "Hoboken", "United States", 40.7433, -74.0324, ["Hoboken NJ"]),
  city("los-angeles-us", "Los Angeles", "United States", 34.0522, -118.2437, ["LA", "Los Angeles CA"]),
  city("seattle-us", "Seattle", "United States", 47.6062, -122.3321, ["Seattle WA"]),
  city("austin-us", "Austin", "United States", 30.2672, -97.7431, ["Austin TX"]),
  city("boston-us", "Boston", "United States", 42.3601, -71.0589, ["Boston MA"]),
  city("chicago-us", "Chicago", "United States", 41.8781, -87.6298, ["Chicago IL"]),
  city("mexico-city-mx", "Mexico City", "Mexico", 19.4326, -99.1332, ["Ciudad de Mexico", "CDMX"]),
  city("naucalpan-mx", "Naucalpan", "Mexico", 19.4785, -99.2396, ["Naucalpan de Juarez"]),
  city("sao-paulo-br", "São Paulo", "Brazil", -23.5505, -46.6333, ["Sao Paulo"]),
  city("guarulhos-br", "Guarulhos", "Brazil", -23.4543, -46.5337),
  city("osasco-br", "Osasco", "Brazil", -23.5325, -46.7917),
  city("buenos-aires-ar", "Buenos Aires", "Argentina", -34.6037, -58.3816),
  city("london-gb", "London", "United Kingdom", 51.5072, -0.1276, ["London UK"]),
  city("croydon-gb", "Croydon", "United Kingdom", 51.3762, -0.0982),
  city("watford-gb", "Watford", "United Kingdom", 51.6565, -0.3903),
  city("cambridge-gb", "Cambridge", "United Kingdom", 52.2053, 0.1218, ["Cambridge UK"]),
  city("paris-fr", "Paris", "France", 48.8566, 2.3522),
  city("boulogne-billancourt-fr", "Boulogne-Billancourt", "France", 48.8397, 2.2399),
  city("berlin-de", "Berlin", "Germany", 52.52, 13.405),
  city("potsdam-de", "Potsdam", "Germany", 52.3906, 13.0645),
  city("amsterdam-nl", "Amsterdam", "Netherlands", 52.3676, 4.9041),
  city("utrecht-nl", "Utrecht", "Netherlands", 52.0907, 5.1214),
  city("lisbon-pt", "Lisbon", "Portugal", 38.7223, -9.1393, ["Lisboa"]),
  city("barcelona-es", "Barcelona", "Spain", 41.3874, 2.1686),
  city("stockholm-se", "Stockholm", "Sweden", 59.3293, 18.0686),
  city("helsinki-fi", "Helsinki", "Finland", 60.1699, 24.9384),
  city("zurich-ch", "Zürich", "Switzerland", 47.3769, 8.5417, ["Zurich"]),
  city("dubai-ae", "Dubai", "United Arab Emirates", 25.2048, 55.2708, ["Dubai UAE"]),
  city("tel-aviv-il", "Tel Aviv", "Israel", 32.0853, 34.7818, ["Tel Aviv-Yafo"]),
  city("lagos-ng", "Lagos", "Nigeria", 6.5244, 3.3792),
  city("ikeja-ng", "Ikeja", "Nigeria", 6.6018, 3.3515),
  city("nairobi-ke", "Nairobi", "Kenya", -1.2921, 36.8219),
  city("cape-town-za", "Cape Town", "South Africa", -33.9249, 18.4241),
  city("stellenbosch-za", "Stellenbosch", "South Africa", -33.9321, 18.8602),
  city("bengaluru-in", "Bengaluru", "India", 12.9716, 77.5946, ["Bangalore"]),
  city("mysuru-in", "Mysuru", "India", 12.2958, 76.6394, ["Mysore"]),
  city("mumbai-in", "Mumbai", "India", 19.076, 72.8777, ["Bombay"]),
  city("delhi-in", "Delhi", "India", 28.6139, 77.209, ["New Delhi"]),
  city("singapore-sg", "Singapore", "Singapore", 1.3521, 103.8198),
  city("johor-bahru-my", "Johor Bahru", "Malaysia", 1.4927, 103.7414, ["JB Malaysia"]),
  city("jakarta-id", "Jakarta", "Indonesia", -6.2088, 106.8456),
  city("tokyo-jp", "Tokyo", "Japan", 35.6762, 139.6503),
  city("yokohama-jp", "Yokohama", "Japan", 35.4437, 139.6380),
  city("kawasaki-jp", "Kawasaki", "Japan", 35.5308, 139.7030),
  city("chiba-jp", "Chiba", "Japan", 35.6074, 140.1065),
  city("seoul-kr", "Seoul", "South Korea", 37.5665, 126.978),
  city("sydney-au", "Sydney", "Australia", -33.8688, 151.2093),
  city("parramatta-au", "Parramatta", "Australia", -33.8150, 151.0011),
  city("melbourne-au", "Melbourne", "Australia", -37.8136, 144.9631),
  city("auckland-nz", "Auckland", "New Zealand", -36.8509, 174.7645),
] as const satisfies readonly CanonicalCity[];

const CITY_BY_ALIAS = new Map<string, CanonicalCity>(
  CANONICAL_CITIES.flatMap((entry) => [entry.label, entry.id, ...entry.aliases].map((alias) => [normalizeCityAlias(alias), entry] as const)),
);

export function normalizeCityAlias(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function resolveCanonicalCity(value: string | null | undefined): CanonicalCity | null {
  if (!value?.trim()) return null;
  return CITY_BY_ALIAS.get(normalizeCityAlias(value)) ?? null;
}

function city(id:string,label:string,country:string,latitude:number,longitude:number,aliases:readonly string[]=[],region?:string):CanonicalCity {
  return { id, label, country, region, latitude, longitude, aliases };
}
