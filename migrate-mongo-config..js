const { API_CONFIG } = require('./src/config/ApiEndpoints');

module.exports = {
  mongodb: {
    url: API_CONFIG.MONGO_URI,
    databaseName: API_CONFIG.DB_NAME || "e-sangrah",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  migrationsDir: "migrations",
  changelogCollectionName: "migrations"
};
