const { getDb } = require('./mongo');
const { ObjectId } = require('mongodb');

const COLLECTION = 'reservations';

async function createReservation(storeId, reservation) {
  const db = getDb();
  return db.collection(COLLECTION).insertOne({
    storeId,
    ...reservation,
    createdAt: new Date()
  });
}

async function getReservations(storeId) {
  const db = getDb();
  return db.collection(COLLECTION).find({ storeId }).toArray();
}

async function deleteReservation(storeId, reservationId) {
  const db = getDb();
  return db.collection(COLLECTION).deleteOne({
    storeId,
    _id: new ObjectId(reservationId)
  });
}

module.exports = {
  createReservation,
  getReservations,
  deleteReservation
};
