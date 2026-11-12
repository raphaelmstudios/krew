// Upload safety, shared by every route that accepts a file (ID documents, selfies, profile
// and portfolio photos, listing photos).
//
// Two rules:
// 1. The saved file's extension comes from the file type we accepted - never from the
//    filename the browser sent. Otherwise "photo.html" labelled as a JPEG would be saved as
//    an .html file and served back as a web page.
// 2. After saving, the file's first bytes must actually match that type (a real JPEG starts
//    FF D8 FF, a PNG 89 50 4E 47, a PDF "%PDF"). The type the browser claims is just a label
//    it chose; the bytes are what the file really is.

import fs from 'node:fs';

const EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
};

// The extension to save a file under, from its accepted type.
export function extensionFor(mimetype) {
  return EXTENSIONS[mimetype] || '';
}

function matchesSignature(filePath, mimetype) {
  const signature = SIGNATURES[mimetype];
  if (!signature) return false;
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(signature.length);
    const bytesRead = fs.readSync(fd, buffer, 0, signature.length, 0);
    return bytesRead === signature.length && signature.every((byte, i) => buffer[i] === byte);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// Checks every file multer just saved. If any one isn't what it claims to be, all of them
// are deleted and false comes back, so the route can refuse the upload as a whole.
export function verifySavedFiles(files) {
  const list = files.filter(Boolean);
  const allGenuine = list.every((file) => matchesSignature(file.path, file.mimetype));
  if (!allGenuine) {
    for (const file of list) fs.unlink(file.path, () => {});
  }
  return allGenuine;
}
