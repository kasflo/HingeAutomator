import { CityChoice } from "./types";

export const FALLBACK_BIG_US_CITIES: CityChoice[] = [
  // Alabama
  { display: "Huntsville", state_token: "alabama", city_token: "huntsville" },
  { display: "Birmingham", state_token: "alabama", city_token: "birmingham" },
  { display: "Montgomery", state_token: "alabama", city_token: "montgomery" },
  { display: "Mobile", state_token: "alabama", city_token: "mobile" },
  // Alaska
  { display: "Anchorage", state_token: "alaska", city_token: "anchorage" },
  // Arizona
  { display: "Phoenix", state_token: "arizona", city_token: "phoenix" },
  { display: "Tucson", state_token: "arizona", city_token: "tucson" },
  { display: "Mesa", state_token: "arizona", city_token: "mesa" },
  { display: "Chandler", state_token: "arizona", city_token: "chandler" },
  // Arkansas
  { display: "Little Rock", state_token: "arkansas", city_token: "little+rock" },
  // California
  { display: "Los Angeles", state_token: "california", city_token: "los+angeles" },
  { display: "San Diego", state_token: "california", city_token: "san+diego" },
  { display: "San Jose", state_token: "california", city_token: "san+jose" },
  { display: "San Francisco", state_token: "california", city_token: "san+francisco" },
  { display: "Fresno", state_token: "california", city_token: "fresno" },
  { display: "Sacramento", state_token: "california", city_token: "sacramento" },
  { display: "Long Beach", state_token: "california", city_token: "long+beach" },
  { display: "Oakland", state_token: "california", city_token: "oakland" },
  { display: "Bakersfield", state_token: "california", city_token: "bakersfield" },
  { display: "Anaheim", state_token: "california", city_token: "anaheim" },
  // Colorado
  { display: "Denver", state_token: "colorado", city_token: "denver" },
  { display: "Colorado Springs", state_token: "colorado", city_token: "colorado+springs" },
  { display: "Aurora", state_token: "colorado", city_token: "aurora" },
  // Connecticut
  { display: "Bridgeport", state_token: "connecticut", city_token: "bridgeport" },
  { display: "Stamford", state_token: "connecticut", city_token: "stamford" },
  // Delaware
  { display: "Wilmington", state_token: "delaware", city_token: "wilmington" },
  // Florida
  { display: "Jacksonville", state_token: "florida", city_token: "jacksonville" },
  { display: "Miami", state_token: "florida", city_token: "miami" },
  { display: "Tampa", state_token: "florida", city_token: "tampa" },
  { display: "Orlando", state_token: "florida", city_token: "orlando" },
  { display: "St. Petersburg", state_token: "florida", city_token: "st+petersburg" },
  { display: "Hialeah", state_token: "florida", city_token: "hialeah" },
  // Georgia
  { display: "Atlanta", state_token: "georgia", city_token: "atlanta" },
  { display: "Columbus", state_token: "georgia", city_token: "columbus" },
  // Hawaii
  { display: "Honolulu", state_token: "hawaii", city_token: "honolulu" },
  // Idaho
  { display: "Boise", state_token: "idaho", city_token: "boise" },
  // Illinois
  { display: "Chicago", state_token: "illinois", city_token: "chicago" },
  { display: "Aurora", state_token: "illinois", city_token: "aurora" },
  { display: "Joliet", state_token: "illinois", city_token: "joliet" },
  // Indiana
  { display: "Indianapolis", state_token: "indiana", city_token: "indianapolis" },
  { display: "Fort Wayne", state_token: "indiana", city_token: "fort+wayne" },
  // Iowa
  { display: "Des Moines", state_token: "iowa", city_token: "des+moines" },
  // Kansas
  { display: "Wichita", state_token: "kansas", city_token: "wichita" },
  { display: "Overland Park", state_token: "kansas", city_token: "overland+park" },
  // Kentucky
  { display: "Louisville", state_token: "kentucky", city_token: "louisville" },
  { display: "Lexington", state_token: "kentucky", city_token: "lexington" },
  // Louisiana
  { display: "New Orleans", state_token: "louisiana", city_token: "new+orleans" },
  { display: "Baton Rouge", state_token: "louisiana", city_token: "baton+rouge" },
  // Maine
  { display: "Portland", state_token: "maine", city_token: "portland" },
  // Maryland
  { display: "Baltimore", state_token: "maryland", city_token: "baltimore" },
  // Massachusetts
  { display: "Boston", state_token: "massachusetts", city_token: "boston" },
  { display: "Worcester", state_token: "massachusetts", city_token: "worcester" },
  // Michigan
  { display: "Detroit", state_token: "michigan", city_token: "detroit" },
  { display: "Grand Rapids", state_token: "michigan", city_token: "grand+rapids" },
  // Minnesota
  { display: "Minneapolis", state_token: "minnesota", city_token: "minneapolis" },
  { display: "Saint Paul", state_token: "minnesota", city_token: "saint+paul" },
  // Mississippi
  { display: "Jackson", state_token: "mississippi", city_token: "jackson" },
  // Missouri
  { display: "Kansas City", state_token: "missouri", city_token: "kansas+city" },
  { display: "St. Louis", state_token: "missouri", city_token: "st+louis" },
  // Montana
  { display: "Billings", state_token: "montana", city_token: "billings" },
  // Nebraska
  { display: "Omaha", state_token: "nebraska", city_token: "omaha" },
  { display: "Lincoln", state_token: "nebraska", city_token: "lincoln" },
  // Nevada
  { display: "Las Vegas", state_token: "nevada", city_token: "las+vegas" },
  { display: "Henderson", state_token: "nevada", city_token: "henderson" },
  { display: "Reno", state_token: "nevada", city_token: "reno" },
  // New Hampshire
  { display: "Manchester", state_token: "new+hampshire", city_token: "manchester" },
  // New Jersey
  { display: "Newark", state_token: "new+jersey", city_token: "newark" },
  { display: "Jersey City", state_token: "new+jersey", city_token: "jersey+city" },
  { display: "Paterson", state_token: "new+jersey", city_token: "paterson" },
  // New Mexico
  { display: "Albuquerque", state_token: "new+mexico", city_token: "albuquerque" },
  // New York
  { display: "New York", state_token: "new+york", city_token: "new+york" },
  { display: "Buffalo", state_token: "new+york", city_token: "buffalo" },
  { display: "Rochester", state_token: "new+york", city_token: "rochester" },
  { display: "Yonkers", state_token: "new+york", city_token: "yonkers" },
  // North Carolina
  { display: "Charlotte", state_token: "north+carolina", city_token: "charlotte" },
  { display: "Raleigh", state_token: "north+carolina", city_token: "raleigh" },
  { display: "Greensboro", state_token: "north+carolina", city_token: "greensboro" },
  { display: "Durham", state_token: "north+carolina", city_token: "durham" },
  // North Dakota
  { display: "Fargo", state_token: "north+dakota", city_token: "fargo" },
  // Ohio
  { display: "Columbus", state_token: "ohio", city_token: "columbus" },
  { display: "Cleveland", state_token: "ohio", city_token: "cleveland" },
  { display: "Cincinnati", state_token: "ohio", city_token: "cincinnati" },
  { display: "Toledo", state_token: "ohio", city_token: "toledo" },
  // Oklahoma
  { display: "Oklahoma City", state_token: "oklahoma", city_token: "oklahoma+city" },
  { display: "Tulsa", state_token: "oklahoma", city_token: "tulsa" },
  // Oregon
  { display: "Portland", state_token: "oregon", city_token: "portland" },
  { display: "Salem", state_token: "oregon", city_token: "salem" },
  // Pennsylvania
  { display: "Philadelphia", state_token: "pennsylvania", city_token: "philadelphia" },
  { display: "Pittsburgh", state_token: "pennsylvania", city_token: "pittsburgh" },
  { display: "Allentown", state_token: "pennsylvania", city_token: "allentown" },
  // Rhode Island
  { display: "Providence", state_token: "rhode+island", city_token: "providence" },
  // South Carolina
  { display: "Charleston", state_token: "south+carolina", city_token: "charleston" },
  { display: "Columbia", state_token: "south+carolina", city_token: "columbia" },
  // South Dakota
  { display: "Sioux Falls", state_token: "south+dakota", city_token: "sioux+falls" },
  // Tennessee
  { display: "Nashville", state_token: "tennessee", city_token: "nashville" },
  { display: "Memphis", state_token: "tennessee", city_token: "memphis" },
  { display: "Knoxville", state_token: "tennessee", city_token: "knoxville" },
  // Texas
  { display: "Houston", state_token: "texas", city_token: "houston" },
  { display: "San Antonio", state_token: "texas", city_token: "san+antonio" },
  { display: "Dallas", state_token: "texas", city_token: "dallas" },
  { display: "Austin", state_token: "texas", city_token: "austin" },
  { display: "Fort Worth", state_token: "texas", city_token: "fort+worth" },
  { display: "El Paso", state_token: "texas", city_token: "el+paso" },
  { display: "Arlington", state_token: "texas", city_token: "arlington" },
  { display: "Corpus Christi", state_token: "texas", city_token: "corpus+christi" },
  { display: "Plano", state_token: "texas", city_token: "plano" },
  { display: "Laredo", state_token: "texas", city_token: "laredo" },
  { display: "Lubbock", state_token: "texas", city_token: "lubbock" },
  { display: "Irving", state_token: "texas", city_token: "irving" },
  { display: "Garland", state_token: "texas", city_token: "garland" },
  // Utah
  { display: "Salt Lake City", state_token: "utah", city_token: "salt+lake+city" },
  { display: "West Valley City", state_token: "utah", city_token: "west+valley+city" },
  // Vermont
  { display: "Burlington", state_token: "vermont", city_token: "burlington" },
  // Virginia
  { display: "Virginia Beach", state_token: "virginia", city_token: "virginia+beach" },
  { display: "Chesapeake", state_token: "virginia", city_token: "chesapeake" },
  { display: "Norfolk", state_token: "virginia", city_token: "norfolk" },
  { display: "Richmond", state_token: "virginia", city_token: "richmond" },
  // Washington
  { display: "Seattle", state_token: "washington", city_token: "seattle" },
  { display: "Spokane", state_token: "washington", city_token: "spokane" },
  { display: "Tacoma", state_token: "washington", city_token: "tacoma" },
  { display: "Vancouver", state_token: "washington", city_token: "vancouver" },
  { display: "Bellevue", state_token: "washington", city_token: "bellevue" },
  // West Virginia
  { display: "Charleston", state_token: "west+virginia", city_token: "charleston" },
  // Wisconsin
  { display: "Milwaukee", state_token: "wisconsin", city_token: "milwaukee" },
  { display: "Madison", state_token: "wisconsin", city_token: "madison" },
  { display: "Green Bay", state_token: "wisconsin", city_token: "green+bay" },
  // Wyoming
  { display: "Cheyenne", state_token: "wyoming", city_token: "cheyenne" },
];
