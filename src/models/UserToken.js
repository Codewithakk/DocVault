// models/UserToken.js
import mongoose from "mongoose";

const userTokenSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deviceId: { type: String, required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });

const UserToken = mongoose.model("UserToken", userTokenSchema);
export default UserToken;
