import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Folder schema with materialized path hierarchy.
 * Supports ACL, soft-delete, and metadata.
 */
const folderSchema = new Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, trim: true }, // URL-friendly identifier
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    parent: { type: Schema.Types.ObjectId, ref: 'Folder', default: null, index: true },
    path: { type: String, index: true }, // materialized path
    ancestors: [{ type: Schema.Types.ObjectId, ref: 'Folder', index: true }], // ancestor references
    depth: { type: Number, default: 0, index: true },
    // Permissions (ACL)
    permissions: [
        {
            principal: { type: Schema.Types.ObjectId, refPath: 'permissions.model' },
            model: { type: String, enum: ['User'] },
            access: { type: String },
            canDownload: { type: Boolean, default: false },
            expiresAt: { type: Date, default: null }, // for timed shares
            customStart: { type: Date, default: null },
            customEnd: { type: Date, default: null },
            duration: { type: String, enum: ['oneday', 'oneweek', 'onemonth', 'custom', 'onetime', 'lifetime'], default: 'lifetime' },
            used: { type: Boolean, default: false }, // for onetime shares
        }
    ],
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active"
    },
    files: [{ type: mongoose.Schema.Types.ObjectId, ref: "File" }],
    isArchived: { type: Boolean, default: false },
    size: { type: Number, default: 0 }, // aggregate size (bytes) of contents
    metadata: { type: Schema.Types.Mixed, default: {} },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true,
    versionKey: '__v'
});

// Enable optimistic concurrency
folderSchema.set('optimisticConcurrency', true);

// Indexes
folderSchema.index({ owner: 1, parent: 1, name: 1 }, { unique: true }); // prevent duplicate sibling names
folderSchema.index({ name: 'text' }); // text search on folder name
folderSchema.index({ owner: 1, path: 1 }); // fast path prefix queries

/**
 * Pre-save middleware:
 * - Generates slug if not present.
 * - Computes path, ancestors, and depth.
 */
folderSchema.pre('save', async function (next) {
    try {
        if (!this.slug) {
            this.slug = this.name
                .toLowerCase()
                .replace(/\s+/g, '-')       // spaces → dashes
                .replace(/[^a-z0-9\-]/g, ''); // remove non-url-safe chars
        }

        if (this.parent) {
            const parentFolder = await this.constructor.findById(this.parent).lean();
            if (!parentFolder) {
                return next(new Error('Parent folder not found'));
            }

            this.ancestors = [...(parentFolder.ancestors || []), parentFolder._id];
            this.path = (parentFolder.path === '/' ? '' : parentFolder.path) + '/' + this.slug;
            this.depth = this.ancestors.length;
        } else {
            this.ancestors = [];
            this.path = '/' + this.slug;
            this.depth = 0;
        }

        next();
    } catch (err) {
        next(err);
    }
});

/* ---------- Static Methods ---------- */

/**
 * Create a new folder with unique slug among siblings.
 */
folderSchema.statics.createFolder = async function (owner, parent, name, createdBy = null) {
    const Folder = this;
    const slugBase = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    let slug = slugBase;
    let counter = 0;

    while (true) {
        try {
            const folder = new Folder({
                owner,
                parent: parent || null,
                name,
                slug,
                createdBy,
                updatedBy: createdBy
            });

            await folder.save(); // path, ancestors, depth auto-computed
            return folder;
        } catch (err) {
            if (err.code === 11000) {
                counter += 1;
                slug = `${slugBase}-${counter}`;
                continue; // retry with new slug
            }
            throw err;
        }
    }
};

/**
 * Get all non-deleted descendants of a folder.
 */
folderSchema.statics.getDescendants = async function (folderId) {
    const Folder = this;
    const root = await Folder.findById(folderId).lean();
    if (!root) return [];
    return Folder.find({ ancestors: root._id, deletedAt: null }).sort({ depth: 1 }).lean();
};

/**
 * Move a folder to a new parent (updates paths + ancestors recursively).
 */
folderSchema.statics.moveFolder = async function (folderId, newParentId, updatedBy = null) {
    const Folder = this;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const folder = await Folder.findById(folderId).session(session);
        if (!folder) throw new Error('Folder not found');

        const oldPath = folder.path;
        const oldAncestors = [...(folder.ancestors || [])];

        let newAncestors = [];
        let newPath;

        if (newParentId) {
            const newParent = await Folder.findById(newParentId).session(session);
            if (!newParent) throw new Error('New parent not found');

            if (String(newParent._id) === String(folder._id) || (newParent.ancestors || []).includes(folder._id)) {
                throw new Error('Cannot move folder into itself or its descendants');
            }

            newAncestors = [...(newParent.ancestors || []), newParent._id];
            newPath = (newParent.path === '/' ? '' : newParent.path) + '/' + folder.slug;
            folder.parent = newParentId;
        } else {
            newAncestors = [];
            newPath = '/' + folder.slug;
            folder.parent = null;
        }

        folder.ancestors = newAncestors;
        folder.depth = newAncestors.length;
        folder.path = newPath;
        folder.updatedBy = updatedBy;
        await folder.save({ session });

        // Update descendants
        const descendants = await Folder.find({ ancestors: folder._id }).session(session);
        for (const desc of descendants) {
            const oldPrefix = [...oldAncestors, folder._id].map(String);
            const newPrefix = [...newAncestors, folder._id].map(String);
            const currentAnc = (desc.ancestors || []).map(String);

            if (JSON.stringify(currentAnc.slice(0, oldPrefix.length)) === JSON.stringify(oldPrefix)) {
                const rest = currentAnc.slice(oldPrefix.length);
                desc.ancestors = [...newPrefix, ...rest];
                desc.depth = desc.ancestors.length;
            }

            if (desc.path?.startsWith(oldPath)) {
                desc.path = desc.path.replace(oldPath, newPath);
            }

            desc.updatedBy = updatedBy;
            await desc.save({ session });
        }

        await session.commitTransaction();
        return folder;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

/**
 * Soft delete a folder (and optionally cascade to descendants).
 */
folderSchema.statics.markDeleted = async function (folderId, cascade = true, deletedBy = null) {
    const Folder = this;
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const root = await Folder.findById(folderId).session(session);
        if (!root) throw new Error('Folder not found');

        root.deletedAt = new Date();
        root.updatedBy = deletedBy;
        await root.save({ session });

        if (cascade) {
            await Folder.updateMany(
                { ancestors: root._id },
                { $set: { deletedAt: new Date(), updatedBy: deletedBy } }
            ).session(session);
        }

        await session.commitTransaction();
        return true;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
};

/* ---------- Instance Methods ---------- */

/**
 * Check if a principal (user, group, or role) has required access.
 */
folderSchema.methods.checkAccess = async function (principals = [], required = 'read') {
    const matches = (ace, pid) => String(ace.principal) === String(pid) && ace.access.includes(required);

    for (const p of principals) {
        if (this.permissions?.some(ace => matches(ace, p.id))) return true;
    }

    if (this.ancestors?.length) {
        const Folder = this.constructor;
        const ancestors = await Folder.find({ _id: { $in: this.ancestors } }).sort({ depth: -1 }).lean();
        for (const anc of ancestors) {
            for (const p of principals) {
                if ((anc.permissions || []).some(ace => matches(ace, p.id))) return true;
            }
        }
    }

    return false;
};

const Folder = mongoose.model('Folder', folderSchema);
export default Folder;