const { getDb } = require("./mongo");
const bcrypt = require("bcrypt");

const COLLECTION = "users";

async function createUser(storeId, password) {
  const db = getDb();
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await db.collection(COLLECTION).insertOne({
    storeId,
    password: hashedPassword,
    createdAt: new Date(),
  });
  return result.insertedId;
}

async function findUserByStoreId(storeId) {
  const db = getDb();
  return db.collection(COLLECTION).findOne({ storeId });
}

async function verifyPassword(user, inputPassword) {
  return bcrypt.compare(inputPassword, user.password);
}

module.exports = {
  createUser,
  findUserByStoreId,
  verifyPassword,
};
