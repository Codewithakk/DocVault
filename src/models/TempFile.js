import mongoose from "mongoose";

const tempFileSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true,
    },
    originalName: {
        type: String,
        required: true,
    },
    s3Filename: {
        type: String,
        required: true,
        unique: true,
    },
    s3Url: {
        type: String,
        required: true,
    },
    fileType: {
        type: String,
        required: true,
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Folder",
        required: false,
    },
    status: {
        type: String,
        enum: ["temp", "permanent", "deleted"],
        default: "temp",
    },
    size: {
        type: Number,
        required: true,
    },
    addDate: {
        type: Date,
        default: Date.now,
    },
});

const TempFile = mongoose.models.TempFile || mongoose.model("TempFile", tempFileSchema);

export default TempFile;
