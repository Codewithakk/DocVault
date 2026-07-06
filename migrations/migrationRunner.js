import mongoose from "mongoose";

// Import your models
import Department from "../src/models/Departments.js";
import Designation from "../src/models/Designation.js";
import Folder from "../src/models/Folder.js";
import File from "../src/models/File.js";
import Document from "../src/models/Document.js";
import logger from "../src/utils/logger.js";

// ------------------ Migration Log Schema ------------------
const migrationLogSchema = new mongoose.Schema({
    collectionName: { type: String, required: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    changes: { type: Object, required: true },
    migratedAt: { type: Date, default: Date.now },
    dryRun: { type: Boolean, default: true }
});

const MigrationLog = mongoose.model("MigrationLog", migrationLogSchema);

// ------------------ Helpers ------------------

// Recursively get schema paths and their defaults
function getAllSchemaPaths(schema) {
    const paths = {};

    schema.eachPath((key, type) => {
        if (key === "_id") return; // skip _id

        if (type.instance === "Embedded" || type.schema) {
            Object.assign(paths, getAllSchemaPaths(type.schema));
        } else if (type.instance === "Decimal128") {
            const def = type.defaultValue !== undefined
                ? (typeof type.defaultValue === "function"
                    ? type.defaultValue()
                    : type.defaultValue)
                : null;
            paths[key] = def !== null ? mongoose.Types.Decimal128.fromString(def.toString()) : null;
        } else if (type.instance === "Array") {
            // Default array: empty array if no default
            paths[key] = type.defaultValue !== undefined ? type.defaultValue : [];
        } else {
            paths[key] = type.defaultValue !== undefined
                ? (typeof type.defaultValue === "function" ? type.defaultValue() : type.defaultValue)
                : null;
        }
    });

    return paths;
}

// Compare document data with schema defaults
function getChangedFields(schemaDefaults, docData) {
    const changed = {};

    for (const key in schemaDefaults) {
        const schemaVal = schemaDefaults[key];
        const docVal = docData[key];

        // Handle arrays
        if (Array.isArray(schemaVal)) {
            if (!Array.isArray(docVal) || docVal.length === 0) {
                changed[key] = schemaVal; // initialize array
            } else {
                // Check for subdocument defaults
                const arrChanges = [];
                for (let i = 0; i < docVal.length; i++) {
                    const elemChanges = getChangedFields(schemaVal[0] || {}, docVal[i]);
                    arrChanges.push(Object.keys(elemChanges).length ? elemChanges : null);
                }
                if (arrChanges.some(c => c)) {
                    changed[key] = arrChanges;
                }
            }
        }
        // Handle objects
        else if (schemaVal && typeof schemaVal === "object" && !Array.isArray(schemaVal)) {
            const nestedChanges = getChangedFields(schemaVal, docVal || {});
            if (Object.keys(nestedChanges).length) {
                changed[key] = nestedChanges;
            }
        }
        // Handle scalar fields
        else if (docVal === undefined || docVal === null) {
            changed[key] = schemaVal;
        }
    }

    return changed;
}

// ------------------ Generic Migration Function ------------------
async function migrateCollection(model, renameMap = {}, dryRun = false) {
    const cursor = model.find({}).cursor();
    const schemaDefaults = getAllSchemaPaths(model.schema);
    let totalChanged = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        let docData = doc.toObject();
        let newData = { ...docData };

        // Apply rename map
        for (const [oldKey, newKey] of Object.entries(renameMap)) {
            if (docData[oldKey] !== undefined) {
                newData[newKey] = docData[oldKey];
                delete newData[oldKey];
            }
        }

        const updates = getChangedFields(schemaDefaults, newData);

        if (Object.keys(updates).length > 0) {
            totalChanged++;
            console.log(`[DRY-RUN=${dryRun}] ${model.modelName} ${doc._id} would update:`, updates);

            if (!dryRun) {
                await model.updateOne({ _id: doc._id }, { $set: updates });
                await MigrationLog.create({
                    collectionName: model.modelName,
                    documentId: doc._id,
                    changes: updates,
                    dryRun
                });
                console.log(`Document ${doc._id} updated and logged`);
            }
        }
    }

    console.log(`Migration complete for ${model.modelName}. Total changed: ${totalChanged}`);
}

// ------------------ Migration Runner ------------------
async function runMigrations() {
    await mongoose.connect("mongodb://localhost:27017/e-sangrah");

    const dryRun = false; // change to false to apply updates

    await migrateCollection(Approval, {}, dryRun);
    await migrateCollection(Department, {}, dryRun);
    await migrateCollection(Designation, {}, dryRun);
    await migrateCollection(Document, {}, dryRun);
    await migrateCollection(Folder, {}, dryRun);
    await migrateCollection(File, {}, dryRun);

    await mongoose.disconnect();
    console.log("All migrations completed.");
}

// ------------------ Execute ------------------
runMigrations().catch(err => {
    logger.error("Migration failed:", err);
    mongoose.disconnect();
});
