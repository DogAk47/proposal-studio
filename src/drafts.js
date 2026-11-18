const database = new Promise((resolve,reject) => {
  const request = indexedDB.open("proposal-studio",1);
  request.onupgradeneeded = () => request.result.createObjectStore("drafts");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
database.catch(() => {});

async function transact(mode,action) {
  const db = await database;
  return new Promise((resolve,reject) => {
    const transaction = db.transaction("drafts",mode);
    const request = action(transaction.objectStore("drafts"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

export const readSaved = (key) => transact("readonly",(store) => store.get(key));
export const saveDraft = (key,value) => transact("readwrite",(store) => store.put(value,key));
