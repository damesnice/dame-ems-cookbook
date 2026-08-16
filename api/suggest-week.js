import Anthropic from "@anthropic-ai/sdk";
import { isAuthed } from "./_auth.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dayProperties = Object.fromEntries(
  DAYS.map((day) => [
    day,
    {
      type: "object",
      properties: {
        breakfast: { type: "string" },
        lunch: { type: "string" },
        dinner: { type: "string" },
        snacks: { type: "string" },
      },
      required: ["breakfast", "lunch", "dinner", "snacks"],
      additionalProperties: false,
    },
  ])
);

const WEEK_SCHEMA = {
  type: "object",
  properties: {
    days: {
      type: "object",
      properties: dayProperties,
      required: DAYS,
      additionalProperties: false,
    },
  },
  required: ["days"],
  additionalProperties: false,
};

export default async function handler(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: "AI suggestions aren't configured yet — ANTHROPIC_API_KEY is missing." });
    return;
  }

  const { weekLabel, recipeNames } = req.body || {};

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: WEEK_SCHEMA },
      },
      system:
        "You plan a family's weekly meals. Suggest one short meal idea (a few words, no instructions) per slot for every day of the week. Favor recipes from the family's own cookbook when they fit, but you can suggest simple everyday meals too. Keep entries brief, like a menu line, e.g. 'Sunday ragù' or 'Yogurt with berries'. Vary meals across the week rather than repeating the same thing daily.",
      messages: [
        {
          role: "user",
          content: `Plan meals for ${weekLabel || "this week"}. Recipes already in the family cookbook: ${
            Array.isArray(recipeNames) && recipeNames.length ? recipeNames.join(", ") : "(none logged yet)"
          }.`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block) {
      res.status(502).json({ error: "AI didn't return a plan." });
      return;
    }
    const parsed = JSON.parse(block.text);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(502).json({ error: err.message || "AI suggestion failed." });
  }
}
