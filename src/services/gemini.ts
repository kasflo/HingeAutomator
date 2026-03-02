import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

export const generateHingePrompts = async (context: {
  city: string;
  nearbyPlace: string;
  job: string;
}) => {
  const prompt = `du bist ich: 21–24, gen z, casual dating / hookup-coded (aber hinge-safe, nicht explizit).
schreibe so, als wäre es schnell auf dem handy getippt: natürlich, leicht messy, nicht zu glatt, nicht "werbetext".
context:
proxy_city: ${context.city}
nearby_place_within_25km: ${context.nearbyPlace}
random_job: ${context.job}
aufgabe:
gib mir für diese 3 hinge prompts jeweils genau 3 optionen (insgesamt 9 optionen):
- i go crazy for
- the way to win me over
- a life goal of mine
regeln:
- alles all lower case
- cute + edgy + flirty, casual/hookup vibe aber hinge-safe (keine expliziten sex-words)
- 6–18 wörter, manche bis 22
- emojis sparsam (0–2)
- keine anführungszeichen
- keine wiederholten strukturen / angles
- keine standardfloskeln ständig ("looking for…" etc)
city regel (wichtig):
- pro prompt genau 3 optionen
- davon genau 1 option city-bezogen (verwende proxy_city ODER nearby_place_within_25km)
- die anderen 2 optionen dürfen NICHT city-bezogen sein
great answer regel (wichtig):
- genau 1 der 9 optionen (insgesamt) bekommt am ende: " — great answer"
- nur diese eine option darf das tag haben
format (WICHTIG):
genau 9 zeilen, ohne nummerierung.
jede zeile startet exakt so:
i go crazy for: <option>
i go crazy for: <option>
i go crazy for: <option>
the way to win me over is: <option>
the way to win me over is: <option>
the way to win me over is: <option>
a life goal of mine: <option>
a life goal of mine: <option>
a life goal of mine: <option>`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  const buckets: Record<string, string[]> = {
    "i go crazy for": [],
    "the way to win me over is": [],
    "a life goal of mine": [],
  };

  text.split("\n").forEach(line => {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith("i go crazy for:")) {
      buckets["i go crazy for"].push(line.split(":").slice(1).join(":").trim());
    } else if (lower.startsWith("the way to win me over is:")) {
      buckets["the way to win me over is"].push(line.split(":").slice(1).join(":").trim());
    } else if (lower.startsWith("a life goal of mine:")) {
      buckets["a life goal of mine"].push(line.split(":").slice(1).join(":").trim());
    }
  });

  return buckets;
};

export const JOB_TITLES = [
  "Nursing Assistant", "Certified Nurse Assistant (CNA)", "Barista", "Gym Staff", "ER Nurse",
  "Licensed Nursing Assistant (LNA)", "Esthetician", "Lash Technician", "Yoga Instructor",
  "Pilates Instructor", "Receptionist", "Sales Associate", "Marketing Coordinator",
  "Social Media Manager", "Content Creator", "Graphic Designer", "Dental Assistant",
  "Medical Assistant", "Preschool Teacher", "Nanny", "Flight Attendant",
  "Real Estate Assistant", "Personal Trainer", "Boutique Manager", "Waitress",
  "Bartender", "Graduate Student", "Research Assistant", "Vet Tech", "Makeup Artist",
  "Hair Stylist", "Interior Design Assistant", "Event Planner", "Public Relations Assistant",
  "Copywriter", "Digital Marketing Specialist", "Administrative Assistant", "Customer Success Associate"
];
