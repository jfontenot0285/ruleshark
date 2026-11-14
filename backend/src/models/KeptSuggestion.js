import mongoose from "mongoose";

const keptSuggestionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceTitle: {
      type: String,
      trim: true,
      default: "",
    },
    sourceName: {
      type: String,
      trim: true,
      default: "",
    },
    suggestionId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    original: {
      type: String,
      required: true,
    },
    proposed: {
      type: String,
      required: true,
    },
    rationale: {
      type: String,
      required: true,
    },
    diff: {
      before: String,
      after: String,
      unified: String,
    },
    mocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

keptSuggestionSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    sourceTitle: this.sourceTitle,
    sourceName: this.sourceName,
    suggestionId: this.suggestionId,
    type: this.type,
    severity: this.severity,
    title: this.title,
    original: this.original,
    proposed: this.proposed,
    rationale: this.rationale,
    diff: this.diff,
    mocked: this.mocked,
    createdAt: this.createdAt,
  };
};

export const KeptSuggestion = mongoose.model("KeptSuggestion", keptSuggestionSchema);
