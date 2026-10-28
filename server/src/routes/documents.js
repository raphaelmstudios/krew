// ID and Selfie Upload Endpoint
//This endpoint allows users to upload their kyc documents (ID and Selfie) for verification
// it does not check whether the ID is real or fake, it just stores the files and marks the user as pending verification. The actual verification is done by a human later on.

import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { db } from '../db.js';

export const documentsRouter = express.Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

//The uploaded files live in the uploads folder, which is outside of the client and server folders. 
// This is to prevent the files from being served directly by the web server, which would be a security risk. 
// The files are served through a separate endpoint that checks whether the user is authorized to view them.
//Render's free tier removes the uploads on every deploy, so we need to create the uploads folder on every server start
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(path.join(UPLOAD_ROOT, 'id-documents'), { recursive: true });
fs.mkdirSync(path.join(UPLOAD_ROOT, 'selfies'), { recursive: true });

// We only accept image files , plus PDF files for ID documents. The selfie must be an image file. 
// We also limit the file size to 5MB.
const ALLOWED_ID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_SELFIE_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB   

// Multer picks each file and saves it to the uploads folder,
// we never use the filename the browser sends, because it can contain malicious characters. 
// Instead we generate a safe filename based on the user id and the current timestamp.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'id_document' ? 'id-documents' : 'selfies';
    cb(null, path.join(UPLOAD_ROOT, folder));
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    cb(null, `user-${req.params.id}-${file.fieldname}-${Date.now()}${safeExt}`);
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

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

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

documentsRouter.post('/:id/documents', (req, res) => {
    // We use multer to handle the file upload. 
    // It saves the files to the uploads folder and adds the file info to req.files.
    // If there is an error, we catch it and return a 400 or 500 response.
    uploadFields(req, res, (uploadErr) => {
        try {
            if (uploadErr) throw uploadErr;
            
            const userId = Number(req.params.id);
            if (!Number.isInteger(userId) || userId <= 0) {
                cleanUpSavedFiles(req.files);
                return res.status(400).json({ error: 'Invalid user id' });
            }

            // Look the user up so we know their account actually exists, and so we
            // have their current file paths in case they're uploading again and the
            // old files need to be replaced.
            const user = db.prepare('SELECT id, id_document_path, selfie_path FROM users WHERE id = ?').get(userId);
            if (!user) {
                cleanUpSavedFiles(req.files);
                return res.status(404).json({ error: 'No account found for that id' });
            }

            const idFile = req.files?.id_document?.[0];
            const selfieFile = req.files?.selfie?.[0];
            if(!idFile || !selfieFile) {
                cleanUpSavedFiles(req.files);
                return res.status(400).json({ error: 'Both id_document and selfie files are required' });
            }
        
        // Stores the relative paths to the uploaded files in the database, 
        // so we can serve them later when the user is verified.
            const idRelativePath = path.join('id-documents', idFile.filename);
            const selfieRelativePath = path.join('selfies', selfieFile.filename);

            db.prepare('UPDATE users SET id_document_path = ?, selfie_path = ? WHERE id = ?').run(
                idRelativePath,
                selfieRelativePath,
                userId
            );

        //if a user has already uploaded documents before, we delete the old files to save space.
            if (user.id_document_path) fs.unlink(path.join(UPLOAD_ROOT, user.id_document_path), () => {});
            if (user.selfie_path) fs.unlink(path.join(UPLOAD_ROOT, user.selfie_path), () => {});

            res.status(200).json({ id: userId, verification_status: 'pending' });
        } catch (err) {
            cleanUpSavedFiles(req.files);
            if (err.message === 'UNSUPPORTED_FILE_TYPE') {
                return res.status(400).json({ error: 'Please upload a JPG, PNG, or PDF file.' });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'Each file must be smaller than 5MB.' });
            }

            console.error('Document upload failed:', err);
            res.status(500).json({ error: 'Something went wrong. Please try again later.' });
        }
    });
});