const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  password: { type: String }, // hashed
  otp: { type: String },
  otpExpires: { type: Date },
});

module.exports = mongoose.model("User", userSchema);
