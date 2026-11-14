import mongoose from "mongoose";

const ruleDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
      required: true,
      lowercase: true,
    },
    size: {
      type: Number,
      required: true,
    },
    source: {
      type: String,
      enum: ["upload", "paste"],
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  { timestamps: true }
);

ruleDocumentSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    title: this.title,
    originalName: this.originalName,
    mimeType: this.mimeType,
    extension: this.extension,
    size: this.size,
    source: this.source,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const RuleDocument = mongoose.model("RuleDocument", ruleDocumentSchema);
