// License: AGPL-3.0
// Code generated with support from CODEX and CODEX CLI.
// Owner / Idea / Management: Dr. Babak Sorkhpour (https://x.com/Drbabakskr)
// recipes_store.js - Recipe Manager & IndexedDB Wrapper v0.11.0

(function () {
  const DB = 'local_agent_data_v2';
  const STORES = {
    recipes: 'recipes',
    chats: 'chats',
    images: 'images',
    learner: 'learner',
    failures: 'failures',
    verifier: 'verifier'
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.recipes)) {
          const os = db.createObjectStore(STORES.recipes, { keyPath: 'id' });
          os.createIndex('host', 'host', { unique: false });
          os.createIndex('domainFingerprint', 'domainFingerprint', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.chats)) {
          const os = db.createObjectStore(STORES.chats, { keyPath: 'id' });
          os.createIndex('host', 'host', { unique: false });
          os.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.images)) {
          const os = db.createObjectStore(STORES.images, { keyPath: 'id' });
          os.createIndex('chatId', 'chatId', { unique: false });
          os.createIndex('host', 'host', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.learner)) db.createObjectStore(STORES.learner, { keyPath: 'domainKey' });
        if (!db.objectStoreNames.contains(STORES.failures)) db.createObjectStore(STORES.failures, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.verifier)) db.createObjectStore(STORES.verifier, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(store, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getByIndex(store, indexName, query) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).index(indexName).getAll(query);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function safeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  class RecipeManager {
    static async saveRecipe({ host, domainFingerprint, selectors, quality = 'PASS', notes = '' }) {
      const id = `${host || 'unknown'}::${domainFingerprint || 'default'}`;
      return put(STORES.recipes, {
        id,
        host: host || 'unknown',
        domainFingerprint: domainFingerprint || 'default',
        selectors: selectors || [],
        quality,
        notes,
        updatedAt: new Date().toISOString()
      });
    }

    static async getRecipe(host, domainFingerprint) {
      const id = `${host || 'unknown'}::${domainFingerprint || 'default'}`;
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.recipes, 'readonly');
        const req = tx.objectStore(STORES.recipes).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    static async saveChat({ host, title, payload }) {
      const id = safeId('chat');
      await put(STORES.chats, { id, host: host || 'unknown', title: title || 'Untitled', payload: payload || {}, createdAt: new Date().toISOString() });
      return id;
    }

    static async saveImage({ chatId, host, blob, mime = 'application/octet-stream', name = 'image.bin' }) {
      return put(STORES.images, { id: safeId('img'), chatId, host: host || 'unknown', blob, mime, name, createdAt: new Date().toISOString() });
    }

    static async getRecipesByHost(host) {
      return getByIndex(STORES.recipes, 'host', host || 'unknown');
    }

    static async saveLearnerState(state) {
      return put(STORES.learner, { ...state, updatedAt: new Date().toISOString() });
    }

    static async getLearnerState(domainKey) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.learner, 'readonly');
        const req = tx.objectStore(STORES.learner).get(domainKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    static async saveFailureCase({ host, domainFingerprint, failureCase }) {
      return put(STORES.failures, { id: safeId('fail'), host, domainFingerprint, failureCase, createdAt: new Date().toISOString() });
    }

    static async saveVerifierMetrics({ host, domainFingerprint, verifierMetrics }) {
      const id = `${host || 'unknown'}::${domainFingerprint || 'default'}`;
      return put(STORES.verifier, { id, host, domainFingerprint, verifierMetrics, updatedAt: new Date().toISOString() });
    }


    static async getVerifierMetrics(host, domainFingerprint) {
      const id = `${host || 'unknown'}::${domainFingerprint || 'default'}`;
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORES.verifier, 'readonly');
        const req = tx.objectStore(STORES.verifier).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    static async purgeLearning() {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction([STORES.learner, STORES.failures, STORES.verifier], 'readwrite');
        tx.objectStore(STORES.learner).clear();
        tx.objectStore(STORES.failures).clear();
        tx.objectStore(STORES.verifier).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  self.RecipeManager = RecipeManager;
  self.RecipesStore = RecipeManager;
})();
