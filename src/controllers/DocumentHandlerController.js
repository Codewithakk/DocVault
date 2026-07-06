
import mongoose from "mongoose";
import SharedWith from "../models/SharedWith.js";
import { activityLogger } from "../helper/activityLogger.js";
// Renew expiration controller
export const renewAccess = async (req, res) => {
    try {
        const { sharedId } = req.params;
        const { duration } = req.body;

        if (!mongoose.Types.ObjectId.isValid(sharedId)) {
            return res.status(400).json({ message: "Invalid shared document ID." });
        }

        const shared = await SharedWith.findById(sharedId);
        if (!shared) return res.status(404).json({ message: "Shared document not found." });

        if (!shared.user.equals(req.user._id)) {
            return res.status(403).json({ message: "You are not authorized to renew this share." });
        }

        const newDuration = duration || shared.duration;
        let newExpiryDate;

        switch (newDuration) {
            case "oneday":
                newExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
                break;
            case "oneweek":
                newExpiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                break;
            case "onemonth":
                newExpiryDate = new Date();
                newExpiryDate.setMonth(newExpiryDate.getMonth() + 1);
                break;
            case "lifetime":
                newExpiryDate = null;
                break;
            case "onetime":
                newExpiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // default 1 day
                shared.used = false;
                break;
            case "custom":
                return res.status(400).json({ message: "Custom duration requires a separate date input." });
            default:
                return res.status(400).json({ message: "Invalid duration type." });
        }

        shared.duration = newDuration;
        shared.expiresAt = newExpiryDate;

        await shared.save();
        await activityLogger({
            actorId: req.user._id,
            entityId: shared.document,
            entityType: "DocumentShare",
            action: "RENEW_ACCESS",
            details: `Share access renewed to '${newDuration}'`,
            meta: { expiresAt: newExpiryDate }
        });

        res.status(200).json({ message: "Share expiration renewed successfully.", shared });

    } catch (err) {
        console.error("Renew expiration error:", err);
        res.status(500).json({ message: "Internal server error." });
    }

};

