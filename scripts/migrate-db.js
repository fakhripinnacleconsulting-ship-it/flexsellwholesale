const mongoose = require("mongoose");
const dns = require("dns");

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // ignore
}

const OLD_URI = "mongodb://kuldeepmaurya4296_db_user:qvjmsJeC24r6Tm2F@ac-6we4ab2-shard-00-00.efpnylx.mongodb.net:27017,ac-6we4ab2-shard-00-01.efpnylx.mongodb.net:27017,ac-6we4ab2-shard-00-02.efpnylx.mongodb.net:27017/flexsell?replicaSet=atlas-9zwg6l-shard-0&authSource=admin&tls=true&appName=Cluster0";
const NEW_SRV_URI = "mongodb+srv://fakhripinnacleconsulting_db_user:QZeCeQoSEZRngbU3@cluster0.oda5lmc.mongodb.net/flexsell?appName=Cluster0";
const NEW_DIRECT_URI = "mongodb://fakhripinnacleconsulting_db_user:QZeCeQoSEZRngbU3@cluster0-shard-00-00.oda5lmc.mongodb.net:27017,cluster0-shard-00-01.oda5lmc.mongodb.net:27017,cluster0-shard-00-02.oda5lmc.mongodb.net:27017/flexsell?replicaSet=atlas-iqb3et-shard-0&authSource=admin&tls=true&appName=Cluster0";


async function runMigration() {
  console.log("=== Starting MongoDB Data Migration ===");
  console.log("Connecting to OLD Database...");
  const oldConn = await mongoose.createConnection(OLD_URI).asPromise();
  console.log("Connected to OLD Database successfully.");

  console.log("Connecting to NEW Database...");
  let newConn;
  try {
    newConn = await mongoose.createConnection(NEW_SRV_URI).asPromise();
    console.log("Connected to NEW Database via SRV URI successfully.");
  } catch (err) {
    console.log("SRV connection failed, trying Direct Shard URI fallback...");
    newConn = await mongoose.createConnection(NEW_DIRECT_URI).asPromise();
    console.log("Connected to NEW Database via Direct Shard URI successfully.");
  }

  const collectionsToMigrate = [
    { name: "cmscontents", filter: {} },
    { name: "hsnrecords", filter: {} },
    { name: "shippingconfigs", filter: {} },
    { name: "coupons", filter: {} },
    { name: "notificationpreferences", filter: {} },
    { name: "customers", filter: { role: "admin" }, label: "Admin Users Only" },
  ];

  const collectionsToSkip = [
    "products",
    "categories",
    "collections",
    "orders",
    "invoices",
    "reviews",
    "inquiries",
    "stocklogs",
    "otpverifications",
  ];

  console.log("\nSkipping operational data collections:", collectionsToSkip.join(", "));

  for (const item of collectionsToMigrate) {
    const colName = item.name;
    const filter = item.filter || {};
    const label = item.label ? ` (${item.label})` : "";
    
    console.log(`\nProcessing '${colName}'${label}...`);
    const oldCollection = oldConn.collection(colName);
    const newCollection = newConn.collection(colName);

    const docs = await oldCollection.find(filter).toArray();
    console.log(`Found ${docs.length} document(s) in OLD '${colName}' matching filter.`);

    if (docs.length > 0) {
      for (const doc of docs) {
        await newCollection.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
      console.log(`Successfully migrated ${docs.length} document(s) to NEW '${colName}'.`);
    } else {
      console.log(`No documents to migrate for '${colName}'.`);
    }
  }

  console.log("\n=== Migration Completed Successfully! ===");
  await oldConn.close();
  await newConn.close();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration Failed with error:", err);
  process.exit(1);
});
