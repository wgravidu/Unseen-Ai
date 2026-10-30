const DB_NAME = 'unseen-ai-cases'
const DB_VERSION = 1
const STORE_NAME = 'cases'

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Could not open the local case database.'))
  })
}

async function withStore(mode, operation) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = operation(store)
    let result
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => {
      db.close()
      resolve(result)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error || new Error('Local case storage failed.'))
    }
  })
}

async function fileToRecord(file) {
  if (!file) return null
  return {
    name: file.name,
    type: file.type || 'image/jpeg',
    size: file.size,
    blob: file,
  }
}

export async function saveCase(record) {
  const image = await fileToRecord(record.imageFile)
  const id = record.id || `${Date.now()}`
  const savedCase = {
    id,
    title: record.title || record.imageFile?.name || 'UNSEEN AI case',
    mode: record.mode,
    roundNo: record.roundNo,
    createdAt: new Date().toISOString(),
    analysis: record.analysis || null,
    localResult: record.localResult || null,
    analysisHistory: record.analysisHistory || [],
    localHistory: record.localHistory || [],
    highlightResult: record.highlightResult || null,
    image,
  }
  await withStore('readwrite', (store) => store.put(savedCase))
  return savedCase
}

export async function listCases() {
  const cases = await withStore('readonly', (store) => store.getAll()) || []
  return cases.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function loadCase(id) {
  return withStore('readonly', (store) => store.get(id))
}

export async function deleteCase(id) {
  await withStore('readwrite', (store) => store.delete(id))
}

export function caseToFile(savedCase) {
  if (!savedCase?.image?.blob) return null
  return new File([savedCase.image.blob], savedCase.image.name || 'saved-case.jpg', {
    type: savedCase.image.type || 'image/jpeg',
  })
}
