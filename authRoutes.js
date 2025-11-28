const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const User = require("../models/User.js");


const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const JWT_SECRET = "SUPER_SECRET_CHANGE_THIS";

// Helper: create JWT (1 hour expiry)
function createToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "1h" });
}

// OPTIONAL: Register (only if you don't already have one)
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existing = await User.findOne({
      $or: [{ email }, { phone }],
    });
    if (existing) {
      return res.json({ success: false, message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashed,
    });

    return res.json({ success: true, userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 NORMAL LOGIN (email or phone + password)
router.post("/login", async (req, res) => {
  try {
    const { loginInput, password } = req.body;

    const user = await User.findOne({
      $or: [{ email: loginInput }, { phone: loginInput }],
    });

    if (!user || !user.password) {
      return res.json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid password" });
    }

    const token = createToken(user._id);
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 SEND OTP
router.post("/send-otp", async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.json({ success: false, message: "Mobile is required" });
    }

    let user = await User.findOne({ phone: mobile });

    if (!user) {
      // auto create user with just phone (you can change this logic)
      user = await User.create({ phone: mobile });
    }

    const otp = otpGenerator.generate(6, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    user.otp = otp;
    user.otpExpires = Date.now() + 5 * 60 * 1000; // 5 mins
    await user.save();

    // TODO: integrate SMS gateway instead of console.log
    console.log("OTP for", mobile, ":", otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 VERIFY OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    const user = await User.findOne({ phone: mobile });

    if (!user || !user.otp) {
      return res.json({ success: false, message: "OTP not requested" });
    }

    if (user.otp !== otp) {
      return res.json({ success: false, message: "Invalid OTP" });
    }

    if (user.otpExpires < Date.now()) {
      return res.json({ success: false, message: "OTP expired" });
    }

    // clear OTP after successful verify
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = createToken(user._id);
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Example Protected Route (for testing)
router.get("/me", authMiddleware, (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
