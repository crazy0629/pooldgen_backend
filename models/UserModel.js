const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  screen_name: {
    type: String
  },
  user_id: {
    type: String
  },
  state: {
    follow: {
        type: Boolean,
        default: false
    },
    tweeted: {
        type: Boolean,
        default: false
    }
  }
});

const UserModel = mongoose.model("user", UserSchema);

module.exports = UserModel;
