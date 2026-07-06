import mongoose from "mongoose";
const { Schema } = mongoose;

/* =========================
   COUNTRY
========================= */
const countrySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }
  },
  { timestamps: true }
);

/* =========================
   STATE
========================= */
const stateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    country: {
      type: Schema.Types.ObjectId,
      ref: "Country",
      required: true
    }
  },
  { timestamps: true }
);

stateSchema.index({ name: 1, country: 1 }, { unique: true });

/* =========================
   CITY
========================= */
const citySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    state: {
      type: Schema.Types.ObjectId,
      ref: "State",
      required: true
    }
  },
  { timestamps: true }
);

citySchema.index({ name: 1, state: 1 }, { unique: true });

/* =========================
   LOCATION SUB-SCHEMA
========================= */
const LocationSchema = new Schema(
  {
    country: { type: Schema.Types.ObjectId, ref: "Country", required: true },
    country_name: { type: String, required: true },
    state: { type: Schema.Types.ObjectId, ref: "State", required: true },
    state_name: { type: String, required: true },
    city: { type: Schema.Types.ObjectId, ref: "City", required: true },
    city_name: { type: String, required: true }
  },
  { _id: false }
);

/* =========================
   MODELS
========================= */
const Country = mongoose.model("Country", countrySchema);
const State = mongoose.model("State", stateSchema);
const City = mongoose.model("City", citySchema);

/* =========================
   EXPORTS
========================= */
export { Country, State, City, LocationSchema };
