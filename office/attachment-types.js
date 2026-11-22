export const attachmentTypes = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json',
};
export const attachmentLimit = 5;
export const attachmentFileBytes = 10 * 1024 * 1024;
export const attachmentImageBytes = 7 * 1024 * 1024;
export const attachmentTotalBytes = 20 * 1024 * 1024;

export function attachmentType(name) {
  const extension = /\.([a-z\d]+)$/i.exec(name)?.[1].toLowerCase();
  return Object.hasOwn(attachmentTypes, extension) ? attachmentTypes[extension] : null;
}
