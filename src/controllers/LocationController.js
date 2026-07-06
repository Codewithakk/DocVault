
import mongoose from 'mongoose';
import { City, Country, State } from '../models/Location.js';

// Country list page
export const showCountryList = async (req, res) => {
    try {
        res.render("pages/location/country-list", {
            pageTitle: "Country List",
            pageDescription: "View all countries within this folder.",
            metaKeywords: "country list, locations, countries",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Error loading country list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load country list.",
            metaKeywords: "country list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load country list"
        });
    }
};

// State list page
export const showStateList = async (req, res) => {
    try {
        res.render("pages/location/state-list", {
            pageTitle: "State List",
            pageDescription: "View all states within this folder.",
            metaKeywords: "state list, locations, states",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user
        });
    } catch (err) {
        logger.error("Error loading state list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load state list.",
            metaKeywords: "state list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load state list"
        });
    }
};

// City list page
export const showCityList = async (req, res) => {
    try {
        const { folderId } = req.params;

        res.render("pages/location/city-list", {
            pageTitle: "City List",
            pageDescription: "View all cities within this folder.",
            metaKeywords: "city list, locations, cities",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            folderId
        });
    } catch (err) {
        logger.error("Error loading city list:", err);
        res.status(500).render("pages/error", {
            pageTitle: "Error",
            pageDescription: "Unable to load city list.",
            metaKeywords: "city list error",
            canonicalUrl: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
            user: req.user,
            message: "Unable to load city list"
        });
    }
};

/* =========================
   COUNTRY CONTROLLERS
========================= */

// CREATE COUNTRY
export const createCountry = async (req, res) => {
  try {
    const { name } = req.body;

    const country = await Country.create({ name });

    res.status(201).json({
      success: true,
      data: country
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL COUNTRIES
export const getCountries = async (req, res) => {
    try {
      let { page = 1, limit = 10, search = '' } = req.query;
  
      page = parseInt(page);
      limit = parseInt(limit);
  
      const filter = {};
  
      // 🔍 Search by name
      if (search) {
        filter.name = { $regex: search, $options: 'i' };
      }
  
      const total = await Country.countDocuments(filter);
  
      const countries = await Country.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
  
      res.json({
        success: true,
        data: countries,
        total,
        page,
        pages: Math.ceil(total / limit)
      });
  
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  

// UPDATE COUNTRY
export const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updated = await Country.findByIdAndUpdate(
      id,
      { name },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE COUNTRY
export const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;

    await Country.findByIdAndDelete(id);

    res.json({ success: true, message: "Country deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   STATE CONTROLLERS
========================= */

// CREATE STATE
export const createState = async (req, res) => {
  try {
    const { name, country } = req.body;

    const state = await State.create({ name, country });

    res.status(201).json({ success: true, data: state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET STATES (OPTIONAL FILTER BY COUNTRY)
export const getStates = async (req, res) => {
    try {
      let { page = 1, limit = 10, search = '', countryId } = req.query;
  
      page = parseInt(page);
      limit = parseInt(limit);
  
      const filter = {};
  
      if (countryId) {
        filter.country = countryId;
      }
  
      if (search) {
        filter.name = { $regex: search, $options: 'i' }; // search by state name
      }
  
      const total = await State.countDocuments(filter);
  
      const states = await State.find(filter)
        .populate("country", "name")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
  
      res.json({
        success: true,
        data: states,
        total,
        page,
        pages: Math.ceil(total / limit)
      });
  
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  

// UPDATE STATE
export const updateState = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country } = req.body;

    const updated = await State.findByIdAndUpdate(
      id,
      { name, country },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE STATE
export const deleteState = async (req, res) => {
  try {
    const { id } = req.params;

    await State.findByIdAndDelete(id);

    res.json({ success: true, message: "State deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* =========================
   CITY CONTROLLERS
========================= */

// CREATE CITY
export const createCity = async (req, res) => {
  try {
    const { name, state } = req.body;

    const city = await City.create({ name, state });

    res.status(201).json({ success: true, data: city });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET CITIES (OPTIONAL FILTER BY STATE)
export const getCities = async (req, res) => {
    try {
      let { page = 1, limit = 10, search = "", stateId } = req.query;
  
      page = parseInt(page);
      limit = parseInt(limit);
  
      const filter = {};
  
      if (stateId) {
        filter.state = stateId;
      }

      if (search) {
        filter.name = { $regex: search, $options: "i" };
      }
  
      const total = await City.countDocuments(filter);
  
      const cities = await City.find(filter)
        .populate({
          path: "state",
          select: "name",
          populate: { path: "country", select: "name" }
        })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
  
      res.json({
        success: true,
        data: cities,
        total,
        page,
        pages: Math.ceil(total / limit)
      });
  
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  

// UPDATE CITY
export const updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, state } = req.body;

    const updated = await City.findByIdAndUpdate(
      id,
      { name, state },
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE CITY
export const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    await City.findByIdAndDelete(id);

    res.json({ success: true, message: "City deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
