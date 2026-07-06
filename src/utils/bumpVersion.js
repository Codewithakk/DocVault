import mongoose from "mongoose";

export const bumpVersion = (currentVersion) => {
    const currentNumber = parseFloat(currentVersion);
    const nextNumber = (Number(currentNumber) + 0.1).toFixed(1);

    const versionLabel = nextNumber.toString();
    const versionNumber = mongoose.Types.Decimal128.fromString(versionLabel);

    return { versionLabel, versionNumber };
};