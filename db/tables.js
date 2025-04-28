const { getDb } = require('./mongo');

const COLLECTION = 'tables';

async function createTable(storeId, table) {
  const db = getDb();
  return db.collection(COLLECTION).insertOne({ storeId, ...table });
}

async function getTables(storeId) {
  const db = getDb();
  return db.collection(COLLECTION).find({ storeId }).toArray();
}

async function updateTableStatus(storeId, tableId, data) {
  const db = getDb();
  return db.collection(COLLECTION).updateOne(
    { storeId, tableId },
    { $set: data }
  );
}

module.exports = {
  createTable,
  getTables,
  updateTableStatus,
};
