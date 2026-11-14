import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { KeptSuggestion } from "../models/KeptSuggestion.js";

const router = Router();

router.use(requireAuth);

router.get("/kept", async (req, res) => {
  try {
    const items = await KeptSuggestion.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ suggestions: items.map((item) => item.toPublic()) });
  } catch (err) {
    console.error("List kept suggestions failed:", err);
    return res.status(500).json({ error: "Failed to load kept suggestions." });
  }
});

router.post("/keep", async (req, res) => {
  try {
    const suggestion = req.body?.suggestion;
    if (!suggestion || typeof suggestion !== "object") {
      return res.status(400).json({ error: "A suggestion object is required." });
    }

    const required = ["id", "type", "severity", "title", "original", "proposed", "rationale"];
    for (const key of required) {
      if (!suggestion[key]) {
        return res.status(400).json({ error: `Suggestion is missing ${key}.` });
      }
    }

    const doc = await KeptSuggestion.create({
      userId: req.user._id,
      sourceTitle: String(req.body?.sourceTitle || "").trim(),
      sourceName: String(req.body?.sourceName || "").trim(),
      suggestionId: String(suggestion.id),
      type: String(suggestion.type),
      severity: String(suggestion.severity),
      title: String(suggestion.title),
      original: String(suggestion.original),
      proposed: String(suggestion.proposed),
      rationale: String(suggestion.rationale),
      diff: suggestion.diff || {
        before: suggestion.original,
        after: suggestion.proposed,
        unified: [
          ...String(suggestion.original).split(/\r?\n/).map((line) => `- ${line}`),
          ...String(suggestion.proposed).split(/\r?\n/).map((line) => `+ ${line}`),
        ].join("\n"),
      },
      mocked: Boolean(req.body?.mocked),
    });

    return res.status(201).json({ suggestion: doc.toPublic() });
  } catch (err) {
    console.error("Keep suggestion failed:", err);
    return res.status(500).json({ error: "Failed to keep suggestion." });
  }
});

router.delete("/kept/:id", async (req, res) => {
  try {
    const deleted = await KeptSuggestion.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Kept suggestion not found." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete kept suggestion failed:", err);
    return res.status(500).json({ error: "Failed to remove kept suggestion." });
  }
});

export default router;
