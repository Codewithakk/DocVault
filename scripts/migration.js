import mongoose from "mongoose";

// Import your models
import Department from "./models/Department.js";
import Designation from "./models/Designation.js";
import Document from "./models/Document.js";
import Folder from "./models/Folder.js";
import File from "./models/File.js";
// import other models as needed

// ------------------ Helpers ------------------

// Deep compare to get changed fields, supports nested objects
function getChangedFields(newData, currentData, path = "") {
    let changed = {};

    for (const key in newData) {
        const newVal = newData[key];
        const currVal = currentData[key];
        const fullPath = path ? `${path}.${key}` : key;

        if (
            typeof newVal === "object" &&
            newVal !== null &&
            !Array.isArray(newVal)
        ) {
            const nestedChanges = getChangedFields(newVal, currVal || {}, fullPath);
            Object.assign(changed, nestedChanges);
        } else if (newVal !== undefined && newVal !== currVal) {
            changed[fullPath] = newVal;
        }
    }

    return changed;
}

// ------------------ Generic Migration Function ------------------

async function migrateCollection(model, migrationFn, batchSize = 100, dryRun = true) {
    const cursor = model.find({}).cursor();
    let totalChanged = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        const newData = migrationFn(doc.toObject());

        if (newData && Object.keys(newData).length > 0) {
            totalChanged++;
            console.log(`[DRY-RUN=${dryRun}] Document ${doc._id} would update:`, newData);

            if (!dryRun) {
                await model.updateOne({ _id: doc._id }, { $set: newData });
                console.log(`Document ${doc._id} updated`);
            }
        }
    }

    console.log(`Migration complete for ${model.modelName}. Total changed: ${totalChanged}`);
}

// ------------------ Example Migration Functions ------------------

// 1. Approval collection: add default remark if missing
function approvalMigration(doc) {
    const updates = {};
    if (!doc.remark) updates.remark = "No remarks provided";
    if (!doc.dueDate) updates.dueDate = new Date(); // example: set dueDate if missing
    return Object.keys(updates).length > 0 ? updates : null;
}

// 2. Department collection: ensure status is set
function departmentMigration(doc) {
    const updates = {};
    if (!doc.status) updates.status = "Active";
    if (doc.priority === undefined) updates.priority = 0;
    return Object.keys(updates).length > 0 ? updates : null;
}

// 3. Designation collection: default description
function designationMigration(doc) {
    const updates = {};
    if (!doc.description) updates.description = "";
    return Object.keys(updates).length > 0 ? updates : null;
}

// 4. Document collection: default isArchived
function documentMigration(doc) {
    const updates = {};
    if (doc.isArchived === undefined) updates.isArchived = false;
    return Object.keys(updates).length > 0 ? updates : null;
}

// ------------------ Migration Runner ------------------

async function runMigrations() {
    await mongoose.connect("mongodb://localhost:27017/testdb", {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const dryRun = true; // set false to actually update

    console.log("Migrating Approval collection...");
    await migrateCollection(Approval, approvalMigration, 100, dryRun);

    console.log("Migrating Department collection...");
    await migrateCollection(Department, departmentMigration, 100, dryRun);

    console.log("Migrating Designation collection...");
    await migrateCollection(Designation, designationMigration, 100, dryRun);

    console.log("Migrating Document collection...");
    await migrateCollection(Document, documentMigration, 100, dryRun);

    // Add other collections as needed
    // await migrateCollection(Folder, folderMigration, 100, dryRun);
    // await migrateCollection(File, fileMigration, 100, dryRun);

    await mongoose.disconnect();
    console.log("All migrations completed.");
}

// ------------------ Execute ------------------
runMigrations().catch(err => {
    console.error("Migration failed:", err);
    mongoose.disconnect();
});
