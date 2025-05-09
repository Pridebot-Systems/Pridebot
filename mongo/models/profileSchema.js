const mongoose = require("mongoose");

const socialLinkSchema = new mongoose.Schema({
  label: { type: String, required: true, default: "Website" },
  url: { type: String, required: true },
});

const avatarSchema = new mongoose.Schema({
  label: { type: String, required: true, default: "Avatar" },
  url: { type: String, required: true },
});

const profileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    preferredName: { type: String },
    bio: { type: String },
    age: { type: Number },

    sexuality: { type: String },
    otherSexuality: { type: String },
    romanticOrientation: { type: String },
    gender: { type: String },
    otherGender: { type: String },
    pronouns: { type: String },
    otherPronouns: { type: String },

    color: { type: String },
    pfp: { type: String },

    badgesVisible: { type: Boolean, default: true },
    premiumVisible: { type: Boolean, default: true },

    pronounpage: { type: String },

    premiumMember: { type: Boolean, default: false },
    premiumSince: { type: Date },
    customWebsites: { type: [socialLinkSchema], default: [] },
    customAvatars: { type: [avatarSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);
