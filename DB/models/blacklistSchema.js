const mongoose = require('mongoose');

const blacklistSchema = new mongoose.Schema({
    blacklistUserIDs: { type: [String], default: [] },
    blacklistGuildIDs: { type: [String], default: [] },
});

module.exports = mongoose.model('Blacklist', blacklistSchema);
