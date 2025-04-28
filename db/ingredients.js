const { getDb } = require('./mongo');

async function getIngredients(storeId) {
  const db = await getDb();
  const doc = await db.collection('ingredients').findOne({ storeId });
  return doc?.ingredients || [];
}

async function updateIngredient(storeId, name, quantity) {
  const db = await getDb();
  await db.collection('ingredients').updateOne(
    { storeId },
    { $set: { [`ingredients.$[elem].quantity`]: quantity } },
    { arrayFilters: [{ "elem.name": name }], upsert: true }
  );
}

async function addIngredient(storeId, ingredient) {
  const db = await getDb();
  await db.collection('ingredients').updateOne(
    { storeId },
    { $push: { ingredients: ingredient } },
    { upsert: true }
  );
}

async function deleteIngredient(storeId, name) {
  const db = await getDb();
  await db.collection('ingredients').updateOne(
    { storeId },
    { $pull: { ingredients: { name: name.toLowerCase() } } }
  );
}

module.exports = {
  getIngredients,
  updateIngredient,
  addIngredient,
  deleteIngredient
};
