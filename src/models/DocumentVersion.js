// models/DocumentVersion.js
import mongoose from "mongoose";
import mongoosePaginate from 'mongoose-paginate-v2';
const { Schema } = mongoose;
const documentVersionSchema = new Schema({
    documentId: {
        type: Schema.Types.ObjectId,
        ref: "Document",
        required: true,
        index: true
    },

    versionNumber: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        index: true
    },

    versionLabel: {
        type: String,
        required: true,
        index: true
    },

    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    changeReason: {
        type: String,
        trim: true,
        maxlength: 500
    },

    /** Complete snapshot of document at this version **/
    snapshot: {
        type: Schema.Types.Mixed,
        required: true
    },

    files: [{
        type: Schema.Types.ObjectId,
        ref: "File"
    }],

    isDraft: {
        type: Boolean,
        default: false
    }

}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

documentVersionSchema.plugin(mongoosePaginate);

/** Optimized indexes for version queries **/
documentVersionSchema.index({ documentId: 1, versionNumber: -1 });
documentVersionSchema.index({ documentId: 1, createdAt: -1 });
documentVersionSchema.index({ documentId: 1, versionLabel: 1 });

/** Virtual for populated createdBy */
documentVersionSchema.virtual('creator', {
    ref: 'User',
    localField: 'createdBy',
    foreignField: '_id',
    justOne: true
});

export default mongoose.model("DocumentVersion", documentVersionSchema);