const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;

const serviceAccount = require("./smart-deals-electronics-firebase-adminsdk-fbsvc-2a63a6296b.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const verify = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "Unauthorized access" });
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.yh8mwoi.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

async function run() {
  try {
    await client.connect();
    const database = client.db("smartDeals");
    const productsCollection = database.collection("products");
    const bidsCollection = database.collection("bids");
    const userCollection = database.collection("user");

    app.get("/products", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.email = email;
      }
      const cursor = productsCollection.find(query);
      // .sort({ price_min: 1 });
      const products = await cursor.toArray();
      res.send(products);
    });

    app.get("/recent-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({
          created_at: -1,
        })
        .limit(6);
      const products = await cursor.toArray();
      res.send(products);
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });

    app.post("/products", async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    app.patch("/products/:id", async (req, res) => {
      const id = req.params.id;
      const updatedProduct = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: updatedProduct.name,
          price: updatedProduct.price,
        },
      };
      const options = {};
      const result = await productsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // Bids APIs

    app.get("/myBids", verify, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        if (email !== req.token_email) {
          return res.status(403).send({ message: "Forbidden" });
        }
        query.buyer_email = email;
      }
      const cursor = bidsCollection.find(query);
      const bids = await cursor.toArray();
      res.send(bids);
    });
    app.get("/products/bids/:productId", verify, async (req, res) => {
      const productId = req.params.productId;
      const query = { product: productId };
      const cursor = bidsCollection.find(query).sort({ bid_price: -1 });
      const bids = await cursor.toArray();
      res.send(bids);
    });

    app.get("/bids/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await bidsCollection.findOne(query);
      res.send(result);
    });

    app.post("/bids", verify, async (req, res) => {
      const bid = req.body;
      const result = await bidsCollection.insertOne(bid);
      res.send(result);
    });

    app.delete("/bids/:id", verify, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await bidsCollection.deleteOne(query);
      res.send(result);
    });

    // user api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const email = req.body.email;
      const query = { email: email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        res.send({ message: "have" });
      } else {
        const result = await userCollection.insertOne(user);
        res.send(result);
      }
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log("server is running at", port);
});
