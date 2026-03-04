import axios from "axios";

export const generateHingePrompts = async (context: {
  city: string;
  nearbyPlace: string;
  job: string;
  selectedPrompts?: string[];
}) => {
  const response = await axios.post("/api/claude/generate-prompts", {
    city: context.city,
    nearbyPlace: context.nearbyPlace,
    job: context.job,
    selectedPrompts: context.selectedPrompts,
  });

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data as Record<string, string[]>;
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
