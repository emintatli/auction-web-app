const express = require("express");
const app = express();
const http = require("http");
var cors = require("cors");
const server = http.createServer(app);
const { uuid } = require("uuidv4");
const { MongoClient } = require("mongodb");
const mongo_url_main =
  "MONGO_PASSWORD_URL_HERE"; // leak olmaması için şifre barındıran url yi kaldırdım
const corsOptions = {
  origin: "https://auction-case-study-private.vercel.app",
  optionsSuccessStatus: 200, //cors (socket için)
};
app.use(cors(corsOptions));
const io = require("socket.io")(server, {
  cors: {
    origin: "https://auction-case-study-private.vercel.app", //cors (api için)
    methods: ["GET", "POST"],
  },
});

app.use("/get", express.json(), async (req, res, next) => {
  const all_auctions = await db_get_auctions();
  res.send(JSON.stringify(all_auctions));
  next();
});
app.use("/add_product/:id", express.json(), (req, res, next) => {
  // ürün eklemek için api add_product/urun_adi şeklinde ekleniyor ve ürün ilk eklendiğinde benzersiz id ve 10dk süre tanınıyor
  const new_default = {
    auction_id: uuid(),
    product_name: req.params.id,
    max_bid: 0,
    max_bid_user: "",
    auction_end_time: Date.now() + 600000, // 10min
  };

  db_add_product(new_default); // database bağlantısı

  res.send(JSON.stringify({ res: "done" }));

  next();
});

io.on("connection", (socket) => {
  // socket

  socket.on("bid", async (msg) => {
    io.emit("bid_loading", { status: "true" }); // aynı anda işlem yapılamaası için işlem bitene kadar arayüzdeki buton disable yapılacak
    const response = await bid_update({
      bid: msg.bid,
      from: msg.from,
      product: msg.product,
    }); // socket ile alınan kullanıcı verileri db e gönderilmeli mi test eden fonksiyona gidiyor
    if (response === "success") {
      // fonksiyondan dönüş olumlu ise tüm kullanıcılar socket ile bilgilendiriliyor ve teklif değerleri güncelleniyor.
      io.emit("bid", {
        bid: msg.bid,
        from: msg.from,
        time: Date.now(),
        product_name: msg.product,
      });
    }
    io.emit("bid_status", { status: response,user:msg.from});
    io.emit("bid_loading", { status: "false" }); // aynı anda işlem yapılamaası için işlem bitince button enable
  });
});

const bid_update = async (data) => {
  console.log(data);
  const client = new MongoClient(mongo_url_main);
  try {
    await client.connect();
    const database = client.db("iyi_makina");
    const collection = database.collection("auction");
    const filter = { auction_id: data.product };
    const updateDoc = {
      $set: {
        max_bid: data.bid, // ilgili açık arttırmada güncellenecek kısımlar belirleniyor.
        max_bid_user: data.from,
      },
    };
    const find = await collection.findOne(filter);
    if (
      find.auction_end_time > Date.now() &&
      parseInt(find.max_bid) < parseInt(data.bid)
    ) {
      // 10dk geçmemişse ve maksimum tekliften büyükse güncelleme işlemi başlatılıyor
      console.log("bid updated!", data.bid, find.max_bid);
      const result = await collection.updateOne(filter, updateDoc);
      return "success";
    } else if (find.auction_end_time < Date.now()) {
      return "timeout";
    } else if (parseInt(find.max_bid) > parseInt(data.bid)) {
      return "lowbid";
    }
  } catch (error) {
    console.log(error.toString());
  } finally {
    await client.close();
  }
};

const db_add_product = async (data) => {
  // db ürün ekleme
  const client = new MongoClient(mongo_url_main);
  try {
    await client.connect();
    const database = client.db("iyi_makina");
    const collection = database.collection("auction");
    const result = await collection.insertOne(data);
  } catch (error) {
    console.log(error.toString());
  } finally {
    await client.close();
  }
};

const db_get_auctions = async () => {
  // tüm açık arttırmaları çekme
  const client = new MongoClient(mongo_url_main);
  try {
    await client.connect();
    const database = client.db("iyi_makina");
    const collection = database.collection("auction");
    const finder = await collection
      .find()
      .toArray()
      .then((docs) => docs);
    return finder;
  } catch (error) {
    console.log(error.toString());
  } finally {
    await client.close();
  }
};

server.listen(process.env.PORT || 5000); //heroku için
