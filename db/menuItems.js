const { getDb } = require("./mongo");
const { ObjectId } = require("mongodb");

const COLLECTION = "menuItems";

async function createMenuItem(storeId, { name, description, price, ingredients }) {
  const db = await getDb();
  return db.collection(COLLECTION).insertOne({
    storeId,
    name,
    description,
    price,
    ingredients,
  });
}

async function getMenuItems(storeId) {
  const db = await getDb();
  return db.collection(COLLECTION)
    .find({ storeId })
    .toArray();
}

async function updateMenuItem(storeId, name, updatedData) {
  const db = await getDb();
  return db.collection(COLLECTION).updateOne(
    { storeId, name },
    { $set: updatedData }
  );
}

async function deleteMenuItem(storeId, name) {
  const db = await getDb();
  return db.collection(COLLECTION).deleteOne({ storeId, name });
}

module.exports = {
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem
};
