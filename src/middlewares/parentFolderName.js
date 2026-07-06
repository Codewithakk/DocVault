import Folder from "../models/Folder.js";

export const ParentFolderName = async (req, res, next) => {
    try {
        const { folderId } = req.params;
        const parentFolder = await Folder.findById(folderId).select("name");
        if (!parentFolder) return res.status(404).json({ success: false, message: "Folder not found" });

        req.parentFolderName = parentFolder.name;
        next();
    } catch (err) {
        next(err);
    }
};
