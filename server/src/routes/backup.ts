import { exportData, importData } from '../controllers/backup'

// Backups embed the full record history, which can exceed the default 1 MiB body limit.
const IMPORT_BODY_LIMIT = 50 * 1024 * 1024

export default [
  {
    method: 'GET',
    url: '/api/backup/export',
    handler: exportData,
  },
  {
    method: 'POST',
    url: '/api/backup/import',
    bodyLimit: IMPORT_BODY_LIMIT,
    handler: importData,
  },
]
