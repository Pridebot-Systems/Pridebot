const mongoose = require("mongoose");

const profileFeedbackSchema = mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  surveyShown: {
    type: Boolean,
    default: false,
  },
  surveyShownAt: {
    type: Date,
  },
  acceptedSurvey: {
    type: Boolean,
    default: null,
  },
  surveyCompleted: {
    type: Boolean,
    default: false,
  },
  surveyCompletedAt: {
    type: Date,
  },
  answers: {
    question1: {
      type: String,
      default: null,
    },
    question2: {
      type: String,
      default: null,
    },
    question3: {
      type: String,
      default: null,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

profileFeedbackSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("ProfileFeedback", profileFeedbackSchema);
