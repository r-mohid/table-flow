const path = require("path");
const bcrypt = require('bcrypt');
const fastify = require("fastify")({
  logger: false,
});
const QRCode = require("qrcode");
const { Server } = require("socket.io");

fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

const Handlebars = require("handlebars");

Handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
  return arg1 === arg2 ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper("inc", function (value) {
  return parseInt(value) + 1;
});

Handlebars.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

const fastifyCookie = require("@fastify/cookie");
const fastifySession = require("@fastify/session");
fastify.register(require("@fastify/formbody"));
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: Handlebars,
  },
});

fastify.register(fastifyCookie);
fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET,
  cookie: { secure: false },
  saveUninitialized: false,
});

const io = new Server(fastify.server);

const { createUser, findUserByStoreId, verifyPassword } = require("./db/users");
const { connectToMongo, getDb } = require("./db/mongo");
const { getTables, createTable, updateTableStatus } = require("./db/tables");
const {
  createReservation,
  getReservations,
  deleteReservation,
} = require("./db/reservations");
const {
  getIngredients,
  updateIngredient,
  addIngredient,
  deleteIngredient,
} = require("./db/ingredients.js");
const {
  createMenuItem,
  getMenuItems,
  updateMenuItem,
  deleteMenuItem,
} = require("./db/menuItems");

fastify.get("/", async (req, reply) => {
  if (req.session.storeId) return reply.redirect("/tables");
  return reply.view("/src/pages/login.hbs");
});

fastify.get("/tables", async (req, reply) => {
  if (!req.session.storeId) return reply.redirect("/login");

  const storeId = req.session.storeId;
  const tables = await getTables(storeId);
  const reservations = await getReservations(storeId);

  return reply.view("/src/pages/tables.hbs", {
    storeId,
    tables,
    reservations,
  });
});

fastify.get("/forgot-password", function (request, reply) {
  let params = {};
  return reply.view("/src/pages/forgot.hbs", {});
});

fastify.get("/qrcode", function (request, reply) {
  return reply.view("/src/pages/qrcode.hbs", {});
});

fastify.get("/login", async (req, reply) => {
  if (req.session.storeId) return reply.redirect("/tables");
  return reply.view("/src/pages/login.hbs");
});

fastify.get("/signup", async (req, reply) => {
  if (req.session.storeId) return reply.redirect("/tables");
  return reply.view("/src/pages/signup.hbs");
});

fastify.get("/logout", async (req, reply) => {
  await req.session.destroy();
  return reply.redirect("/login");
});

fastify.get("/orders", async function (req, reply) {
  if (!req.session.storeId) {
    return reply.redirect("/login");
  }
  return reply.view("/src/pages/orders.hbs", {});
});

fastify.get("/generate-qrcode", async (request, reply) => {
  const qrCode = await QRCode.toDataURL("table-3");
  return { qrCode };
});

fastify.get("/scan-success", async (request, reply) => {
  io.emit("scanned");
  return { status: "success" };
});

fastify.post("/signup", async (req, reply) => {
  const { storeid, password } = req.body;

  const existing = await findUserByStoreId(storeid);
  if (existing) {
    return reply.code(400).send({ error: "Store ID already exists." });
  }

  await createUser(storeid, password);
  return reply.redirect("/login");
});

fastify.post("/login", async (req, reply) => {
  const { storeid, password } = req.body;
  const user = await findUserByStoreId(storeid);

  if (!user || !(await verifyPassword(user, password))) {
    return reply.code(401).send({ error: "Invalid credentials." });
  }

  req.session.storeId = storeid;

  return reply.redirect("/tables");
});

fastify.post('/reset-password', async (req, reply) => {
  const { storeid, newPassword } = req.body;

  if (!storeid || !newPassword) {
    return reply.code(400).send({ error: 'Store ID and new password are required.' });
  }

  const db = await getDb();
  const usersCollection = db.collection('users');

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  const result = await usersCollection.updateOne(
    { storeId: storeid },
    { $set: { password: hashedPassword } }
  );

  if (result.modifiedCount > 0) {
    return reply.send({ success: true });
  } else {
    return reply.code(404).send({ error: 'Store ID not found.' });
  }
});

fastify.post("/api/tables", async (req, reply) => {
  const { tableId, floor, maxOccupants } = req.body;
  const storeId = req.session.storeId;

  await createTable(storeId, {
    tableId,
    floor,
    maxOccupants,
    status: "unoccupied",
    users: 0,
    notes: "",
    warning: "",
  });

  reply.send({ success: true, tableId });
});

fastify.post("/api/reservations", async (req, reply) => {
  const storeId = req.session.storeId;
  const { name, partySize, notes } = req.body;

  const result = await createReservation(storeId, { name, partySize, notes });
  reply.send({ success: true, id: result.insertedId.toString() });
});

fastify.delete("/api/reservations/:id", async (req, reply) => {
  const storeId = req.session.storeId;
  const reservationId = req.params.id;

  await deleteReservation(storeId, reservationId);
  reply.send({ success: true });
});

fastify.put("/api/tables/:tableId", async (req, reply) => {
  const storeId = req.session.storeId;
  const tableId = req.params.tableId;
  const update = req.body;

  await updateTableStatus(storeId, tableId, update);
  reply.send({ success: true });
});

fastify.get("/api/ingredients", async (req, reply) => {
  const storeId = req.session.storeId;
  const ingredients = await getIngredients(storeId);
  reply.send({ ingredients });
});

fastify.post("/api/ingredients", async (req, reply) => {
  const storeId = req.session.storeId;
  const { name, quantity } = req.body;

  if (!name || quantity == null) {
    return reply.code(400).send({ error: "Name and quantity required." });
  }

  await addIngredient(storeId, { name: name.toLowerCase(), quantity });

  reply.send({ success: true });
});

fastify.patch("/api/ingredients/update", async (req, reply) => {
  const storeId = req.session.storeId;
  const { name, quantity } = req.body;

  await updateIngredient(storeId, name.toLowerCase(), quantity);
  reply.send({ success: true });
});

fastify.delete("/api/ingredients", async (req, reply) => {
  const storeId = req.session.storeId;
  const { name } = req.body;

  if (!name)
    return reply.code(400).send({ success: false, error: "Name is required" });

  await deleteIngredient(storeId, name.toLowerCase());
  reply.send({ success: true });
});

fastify.get("/api/menu-items", async (req, reply) => {
  const storeId = req.session.storeId;
  const items = await getMenuItems(storeId);
  reply.send({ menuItems: items });
});

fastify.post("/api/menu-items", async (req, reply) => {
  const storeId = req.session.storeId;
  const { name, description, price, ingredients } = req.body;

  if (!name || !price || !ingredients) {
    return reply.code(400).send({ error: "Missing required fields." });
  }

  await createMenuItem(storeId, { name, description, price, ingredients });
  reply.send({ success: true });
});

fastify.put("/api/menu-items/:name", async (req, reply) => {
  const storeId = req.session.storeId;
  const name = req.params.name;
  const updatedData = req.body;

  await updateMenuItem(storeId, name, updatedData);
  reply.send({ success: true });
});

fastify.delete("/api/menu-items/:name", async (req, reply) => {
  const storeId = req.session.storeId;
  const name = req.params.name;

  await deleteMenuItem(storeId, name);
  reply.send({ success: true });
});

fastify.get("/menu/:storeId", async (req, reply) => {
  const storeId = req.params.storeId;

  const menuItems = await getMenuItems(storeId);

  return reply.view("/src/pages/publicMenu.hbs", {
    storeId,
    menuItems,
  });
});

fastify.post("/api/orders", async (req, reply) => {
  const storeId = req.session.storeId;
  const { tableId, orders } = req.body;

  if (!storeId || !orders) {
    return reply.code(400).send({ success: false, message: "Missing data." });
  }

  const db = await getDb();

  const menuItems = await db
    .collection("menuItems")
    .find({ storeId })
    .toArray();
  const ingredientsUpdate = {};

  const orderDetails = [];

  orders.forEach((order) => {
    const item = menuItems.find((m) => m.name === order.name);
    if (item) {
      item.ingredients.forEach((ingredient) => {
        if (!ingredientsUpdate[ingredient.ingredient]) {
          ingredientsUpdate[ingredient.ingredient] = 0;
        }
        ingredientsUpdate[ingredient.ingredient] += ingredient.quantity;
      });

      orderDetails.push({
        name: item.name,
        price: item.price,
        ingredients: item.ingredients,
      });
    }
  });

  for (const [ingredientName, qtyToReduce] of Object.entries(
    ingredientsUpdate
  )) {
    await db
      .collection("ingredients")
      .updateOne(
        { storeId, "ingredients.name": ingredientName },
        { $inc: { "ingredients.$.quantity": -qtyToReduce } }
      );
  }

  await db.collection("orders").insertOne({
    storeId,
    tableId,
    items: orderDetails,
    timestamp: new Date(),
  });

  reply.send({ success: true });
});

fastify.get("/api/floors", async (req, reply) => {
  const storeId = req.session.storeId;
  const db = await getDb();

  const floorDoc = await db.collection("floors").findOne({ storeId });

  if (floorDoc && floorDoc.floors) {
    reply.send({ floors: floorDoc.floors });
  } else {
    reply.send({ floors: [] });
  }
});

fastify.post("/api/floors", async (req, reply) => {
  const storeId = req.session.storeId;
  const { floor } = req.body;

  if (!floor) {
    return reply
      .code(400)
      .send({ success: false, error: "Floor name required." });
  }

  const db = await getDb();
  await db
    .collection("floors")
    .updateOne({ storeId }, { $addToSet: { floors: floor } }, { upsert: true });

  reply.send({ success: true });
});

fastify.delete("/api/floors/:floorName", async (req, reply) => {
  const storeId = req.session.storeId;
  const floorName = req.params.floorName;

  if (!storeId || !floorName) {
    return reply
      .code(400)
      .send({ success: false, message: "Missing storeId or floorName" });
  }

  const db = await getDb();

  const result = await db
    .collection("floors")
    .updateOne({ storeId }, { $pull: { floors: floorName } });

  if (result.modifiedCount > 0) {
    reply.send({ success: true });
  } else {
    reply.send({
      success: false,
      message: "Floor not found or already deleted.",
    });
  }
});

fastify.get("/statistics", async (req, reply) => {
  if (!req.session.storeId) return reply.redirect("/login");

  return reply.view("/src/pages/statistics.hbs", {});
});

fastify.get("/api/statistics-data", async (req, reply) => {
  const storeId = req.session.storeId;
  if (!storeId) {
    return reply.code(401).send({ success: false, message: "Unauthorized" });
  }

  const db = await getDb();

  const totalOrders = await db.collection("orders").countDocuments({ storeId });

  const orders = await db.collection("orders").find({ storeId }).toArray();
  const itemCounts = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    });
  });

  const topMenuItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) // Top 5
    .map(([name, count]) => ({ name, count }));

  const ingredientUsage = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      item.ingredients.forEach((ingredient) => {
        ingredientUsage[ingredient.ingredient] =
          (ingredientUsage[ingredient.ingredient] || 0) + ingredient.quantity;
      });
    });
  });

  const ingredientsDoc = await db
    .collection("ingredients")
    .findOne({ storeId });
  const stockAlerts = [];
  if (ingredientsDoc && ingredientsDoc.ingredients) {
    ingredientsDoc.ingredients.forEach((ing) => {
      if (ing.quantity <= 5) {
        stockAlerts.push({ name: ing.name, quantity: ing.quantity });
      }
    });
  }

  const revenueToday = orders
    .filter((order) => {
      const today = new Date();
      const orderDate = new Date(order.timestamp);
      return orderDate.toDateString() === today.toDateString();
    })
    .reduce(
      (sum, order) => sum + order.items.reduce((s, i) => s + (i.price || 0), 0),
      0
    );

  const revenueTotal = orders.reduce((sum, order) => {
    return sum + order.items.reduce((s, i) => s + (i.price || 0), 0);
  }, 0);

  reply.send({
    totalOrders,
    topMenuItems,
    ingredientUsage,
    stockAlerts,
    revenueToday,
    revenueTotal,
  });
});

connectToMongo()
  .then(() => {
    fastify.listen(
      { port: process.env.PORT, host: "0.0.0.0" },
      function (err, address) {
        if (err) {
          console.error(err);
          process.exit(1);
        }
        console.log(`🚀 App running at ${address}`);
      }
    );
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  });
