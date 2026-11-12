// ID and Selfie Upload Endpoint
//This endpoint allows users to upload their kyc documents (ID and Selfie) for verification
// it does not check whether the ID is real or fake, it just stores the files and marks the user as pending verification. The actual verification is done by a human later on.
// Security pass: only the logged-in owner of the account can upload, and only while the
// account is still waiting on review. Before this, anyone who knew (or guessed) a user id
// could replace that person's ID and selfie.

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { extensionFor, verifySavedFiles } from '../uploadSafety.js';
import { UPLOAD_ROOT } from '../paths.js';

export const documentsRouter = express.Router();


//The uploaded files live in the uploads folder, which is outside of the client and server folders. 
// ID documents and selfies are never served publicly - only an admin can open them, through
// GET /api/admin/users/:id/files/:kind (routes/admin.js).
//Render's free tier removes the uploads on every deploy, so we need to create the uploads folder on every server start
// UPLOAD_ROOT comes from paths.js (UPLOADS_DIR environment variable, or server/uploads).
fs.mkdirSync(path.join(UPLOAD_ROOT, 'id-documents'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_ROOT, 'selfies'), { recursive: true });

// We only accept image files , plus PDF files for ID documents. The selfie must be an image file. 
// We also limit the file size to 5MB.
const ALLOWED_ID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_SELFIE_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB   

// Multer picks each file and saves it to the uploads folder,
// we never use the filename the browser sends, because it can contain malicious characters. 
// Instead we build our own from the logged-in user's id and the current time, and the
// extension comes from the file type we accepted (see uploadSafety.js).
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'id_document' ? 'id-documents' : 'selfies';
    cb(null, path.join(UPLOAD_ROOT, folder));
  },
  filename: (req, file, cb) => {
    cb(null, `user-${req.user.id}-${file.fieldname}-${Date.now()}${extensionFor(file.mimetype)}`);
  },
});

function fileFilter(req, file, cb) {
    const allowed = file.fieldname === 'id_document' ? ALLOWED_ID_TYPES : ALLOWED_SELFIE_TYPES;
    if (!allowed.includes(file.mimetype)) {
        cb(new Error('UNSUPPORTED_FILE_TYPE'));
        return;
    }
    cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE, files: 2 } });

// The field names MUST match what the frontend sends in its form data.
const uploadFields = upload.fields([
    { name: 'id_document', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
]);


//This is when we are about to reject a request after multer already saved one
//This deletes all the files that were saved by multer, so we don't leave unused files on the server.

function cleanUpSavedFiles(files) {
    if (!files) return;
    for (const fieldFiles of Object.values(files)) {
        for (const file of fieldFiles) {
            fs.unlink(file.path, (err) => {
                if (err) console.error('Could not remove unused upload:', file.path, err.message);
            });
        }
    }
}

// Who may upload: the logged-in account itself (the :id in the URL has to be their own),
// and only while it's still pending - an approved account's ID can't be swapped out
// after an admin has already checked it.
function canUploadDocuments(req, res, next) {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId !== req.user.id) {
        return res.status(403).json({ error: 'You can only upload documents for your own account.' });
    }
    if (req.user.verification_status !== 'pending') {
        return res.status(409).json({ error: 'Your account has already been reviewed.' });
    }
    next();
}

documentsRouter.post('/:id/documents', requireAuth, canUploadDocuments, (req, res) => {
    // We use multer to handle the file upload. 
    // It saves the files to the uploads folder and adds the file info to req.files.
    // If there is an error, we catch it and return a 400 or 500 response.
    uploadFields(req, res, (uploadErr) => {
        try {
            if (uploadErr) throw uploadErr;

            const idFile = req.files?.id_document?.[0];
            const selfieFile = req.files?.selfie?.[0];
            if(!idFile || !selfieFile) {
                cleanUpSavedFiles(req.files);
                return res.status(400).json({ error: 'Both id_document and selfie files are required' });
            }

            // The files' first bytes have to match the type they claimed to be.
            if (!verifySavedFiles([idFile, selfieFile])) {
                return res.status(400).json({ error: "One of those files isn't a real JPG, PNG or PDF. Please choose the original photo or scan." });
            }

            // Look up their current file paths in case they're uploading again and the
            // old files need to be replaced.
            const user = db.prepare('SELECT id_document_path, selfie_path FROM users WHERE id = ?').get(req.user.id);

        // Stores the relative paths to the uploaded files in the database (always with forward
        // slashes, so they read the same on Windows and on the Linux server).
            const idRelativePath = `id-documents/${idFile.filename}`;
            const selfieRelativePath = `selfies/${selfieFile.filename}`;

            db.prepare('UPDATE users SET id_document_path = ?, selfie_path = ? WHERE id = ?').run(
                idRelativePath,
                selfieRelativePath,
                req.user.id
            );

        //if a user has already uploaded documents before, we delete the old files to save space.
            if (user.id_document_path) fs.unlink(path.join(UPLOAD_ROOT, user.id_document_path), () => {});
            if (user.selfie_path) fs.unlink(path.join(UPLOAD_ROOT, user.selfie_path), () => {});

            res.status(200).json({ id: req.user.id, verification_status: 'pending' });
        } catch (err) {
            cleanUpSavedFiles(req.files);
            if (err.message === 'UNSUPPORTED_FILE_TYPE') {
                return res.status(400).json({ error: 'Please upload a JPG, PNG, or PDF file.' });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Each file must be smaller than 5MB.' });
            }
            if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({ error: 'Upload exactly one ID document and one selfie.' });
            }

            console.error('Document upload failed:', err);
            res.status(500).json({ error: 'Something went wrong. Please try again later.' });
        }
    });
});
