const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Recipient name is required"],
        trim: true,
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        match: [/^\d{10}$/, "Enter a valid 10-digit phone number"],
    },
    addressLine1: {
        type: String,
        required: [true, "Address line 1 is required"],
        trim: true,
    },
    addressLine2: {
        type: String,
        trim: true,
    },
    city: {
        type: String,
        required: [true, "City is required"],
        trim: true,
    },
    state: {
        type: String,
        required: [true, "State is required"],
        trim: true,
    },
    postalCode: {
        type: String,
        required: [true, "Postal code is required"],
        trim: true,
        match: [/^\d{6}$/, "Enter a valid 6-digit postal code"],
    },
    country: {
        type: String,
        required: [true, "Country is required"],
        trim: true,
        default: "India",
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true,
        match: [/.+@.+\..+/, "Enter Valid Email"],
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^\d{10}$/, "Enter 10 digit"],
    },
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    otp: { type: String }, // Optional, not used with Firebase
    otpExpires: { type: Date }, // Optional, not used with Firebase
    firebaseUid: {
        type: String,
        unique: true,
        sparse: true,
    },
    phoneVerified: {
        type: Boolean,
        default: false,
    },
    addresses: [addressSchema], // Array of addresses
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);